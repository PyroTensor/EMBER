"""Two-way diff of ``contracts/openapi_v1.yaml`` (the contract) vs ``create_app().openapi()`` (what we serve).

Reports, as ``✗`` lines, any semantic difference in either direction:
  * operations (method + path) missing from the app, or served but not in the contract,
  * parameters (presence, required), ``requestBody.required`` and the set of documented response codes,
  * component schemas in the contract that the app does not define,
  * fields of contract schemas (components, request bodies, 200 responses) missing in or extra in the app,
  * required-ness, enum values and nullability that differ.
``$ref`` (including the external ``schema_v1.json``), ``allOf`` and nullable ``anyOf`` are resolved; nested
objects and array items are compared recursively. Descriptions, titles, numeric/length bounds, operationIds
and extra component names (e.g. enums the app names separately) are ignored: they don't change what the
generated frontend types mean. Exit code 1 on drift, 0 when the app matches the contract.

Usage (from backend/): ``make contract-check`` or ``uv run python scripts/check_contract.py``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

import yaml

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))  # scripts/ is not a package; make `app` importable

from app.main import create_app  # noqa: E402

CONTRACTS_DIR = BACKEND_DIR.parent / "contracts"
CONTRACT_FILE = CONTRACTS_DIR / "openapi_v1.yaml"
HTTP_METHODS = ("get", "put", "post", "delete", "patch", "options", "head")
MAX_DEPTH = 8

Schema = dict[str, Any]


class Resolver:
    """Resolves local (``#/...``) and file (``schema_v1.json``) refs and flattens allOf / nullable anyOf."""

    def __init__(self, root: Schema, base_dir: Path | None) -> None:
        self.root = root
        self.base_dir = base_dir
        self._files: dict[str, Schema] = {}

    def _deref(self, ref: str) -> Schema:
        file_part, _, pointer = ref.partition("#")
        if file_part:
            if self.base_dir is None:
                raise ValueError(f"external $ref not supported here: {ref}")
            if file_part not in self._files:
                self._files[file_part] = json.loads((self.base_dir / file_part).read_text(encoding="utf-8"))
            doc = self._files[file_part]
        else:
            doc = self.root
        node: Any = doc
        for part in filter(None, pointer.split("/")):
            node = node[part.replace("~1", "/").replace("~0", "~")]
        return dict(node)

    def resolve(self, schema: Schema | None) -> Schema:
        """Return a flat schema: refs followed, allOf merged, ``X | None`` anyOf/oneOf collapsed to X."""
        if not schema:
            return {}
        seen: set[str] = set()
        while "$ref" in schema:
            ref = schema["$ref"]
            if ref in seen:
                break
            seen.add(ref)
            schema = self._deref(ref)
        if "allOf" in schema:
            merged: Schema = {"type": "object", "properties": {}, "required": []}
            for part in [*schema["allOf"], {k: v for k, v in schema.items() if k != "allOf"}]:
                sub = self.resolve(part)
                merged["properties"].update(sub.get("properties", {}))
                merged["required"] += [r for r in sub.get("required", []) if r not in merged["required"]]
                if "items" in sub:
                    merged["items"] = sub["items"]
            return merged
        for key in ("anyOf", "oneOf"):
            if key in schema:
                branches = [b for b in schema[key] if b.get("type") != "null"]
                if len(branches) == 1:
                    return self.resolve(branches[0])
        return schema


def _nullable(schema: Schema | None) -> bool:
    """True for ``nullable: true``, ``type: [..., "null"]`` or an anyOf/oneOf null branch (unresolved)."""
    if not schema:
        return False
    t = schema.get("type")
    if schema.get("nullable") or (isinstance(t, list) and "null" in t):
        return True
    return any(b.get("type") == "null" for key in ("anyOf", "oneOf") for b in schema.get(key, []))


def _enum(schema: Schema) -> list[str] | None:
    values = schema.get("enum")
    return sorted(map(str, values)) if values is not None else None


def _is_array(schema: Schema) -> bool:
    t = schema.get("type")
    return t == "array" or (isinstance(t, list) and "array" in t)


def compare(
    where: str,
    want: Schema | None,
    have: Schema | None,
    c: Resolver,
    g: Resolver,
    problems: list[str],
    depth: int = 0,
) -> None:
    """Record differences between contract schema ``want`` and app schema ``have``, in both directions."""
    if depth > MAX_DEPTH:
        return
    w, h = c.resolve(want), g.resolve(have)
    if not w:
        return
    if _nullable(want) != _nullable(have) and not (_nullable(w) or _nullable(h)):
        problems.append(f"{where}: nullable in {'contract' if _nullable(want) else 'app'} only")
    if _enum(w) != _enum(h):
        problems.append(f"{where}: enum differs (contract={_enum(w)}, app={_enum(h)})")
    if _is_array(w):
        if _is_array(h):
            compare(f"{where}[]", w.get("items"), h.get("items"), c, g, problems, depth + 1)
        elif "items" in w:
            problems.append(f"{where}: expected an array")
        return
    w_props: Schema = w.get("properties", {})
    if not w_props:
        return
    h_props: Schema = h.get("properties", {})
    w_required, h_required = set(w.get("required", [])), set(h.get("required", []))
    for name in sorted(h_props.keys() - w_props.keys()):
        problems.append(f"{where}.{name}: extra field in app (not in contract)")
    for name, sub in w_props.items():
        if name not in h_props:
            problems.append(f"{where}.{name}: missing field")
            continue
        if name in w_required and name not in h_required:
            problems.append(f"{where}.{name}: should be required")
        elif name in h_required and name not in w_required:
            problems.append(f"{where}.{name}: required in app, optional in contract")
        compare(f"{where}.{name}", sub, h_props[name], c, g, problems, depth + 1)


def _json_schema(container: Schema | None) -> Schema | None:
    if not container:
        return None
    schema: Schema | None = container.get("content", {}).get("application/json", {}).get("schema")
    return schema


def check_operation(
    op_name: str, want: Schema, have: Schema, c: Resolver, g: Resolver, problems: list[str]
) -> None:
    """Parameters, ``requestBody.required`` and documented response codes of one operation."""
    w_params = {(p["in"], p["name"]): p for p in want.get("parameters", [])}
    h_params = {(p["in"], p["name"]): p for p in have.get("parameters", [])}
    for key in sorted(w_params.keys() - h_params.keys()):
        problems.append(f"{op_name}: missing {key[0]} parameter {key[1]!r}")
    for key in sorted(h_params.keys() - w_params.keys()):
        problems.append(f"{op_name}: extra {key[0]} parameter {key[1]!r} (not in contract)")
    for key in sorted(w_params.keys() & h_params.keys()):
        if bool(w_params[key].get("required")) != bool(h_params[key].get("required")):
            problems.append(f"{op_name}: {key[0]} parameter {key[1]!r} required-ness differs")
        where = f"{op_name} {key[0]} {key[1]}"
        compare(where, w_params[key].get("schema"), h_params[key].get("schema"), c, g, problems)
    w_body, h_body = want.get("requestBody") or {}, have.get("requestBody") or {}
    if (w_body or h_body) and bool(w_body.get("required")) != bool(h_body.get("required")):
        problems.append(
            f"{op_name}: requestBody.required differs "
            f"(contract={bool(w_body.get('required'))}, app={bool(h_body.get('required'))})"
        )
    w_codes, h_codes = set(want.get("responses", {})), set(have.get("responses", {}))
    if w_codes != h_codes:
        problems.append(
            f"{op_name}: response codes differ (contract={sorted(w_codes)}, app={sorted(h_codes)})"
        )


def check(contract: Schema, generated: Schema) -> list[str]:
    c = Resolver(contract, CONTRACTS_DIR)
    g = Resolver(generated, None)
    problems: list[str] = []

    gen_paths: Schema = generated.get("paths", {})
    for path, item in contract.get("paths", {}).items():
        for method in HTTP_METHODS:
            if method not in item:
                continue
            op_name = f"{method.upper()} {path}"
            gen_op = gen_paths.get(path, {}).get(method)
            if gen_op is None:
                problems.append(f"missing operation {op_name}")
                continue
            check_operation(op_name, item[method], gen_op, c, g, problems)
            want_body = _json_schema(item[method].get("requestBody"))
            if want_body is not None:
                have_body = _json_schema(gen_op.get("requestBody"))
                if have_body is None:
                    problems.append(f"{op_name} request: missing JSON body")
                else:
                    compare(f"{op_name} request", want_body, have_body, c, g, problems)
            want_ok = _json_schema(item[method].get("responses", {}).get("200"))
            if want_ok is not None:
                have_ok = _json_schema(gen_op.get("responses", {}).get("200"))
                compare(f"{op_name} 200", want_ok, have_ok or {}, c, g, problems)

    contract_paths: Schema = contract.get("paths", {})
    for path, item in gen_paths.items():
        for method in HTTP_METHODS:
            if method in item and method not in contract_paths.get(path, {}):
                problems.append(f"extra operation {method.upper()} {path} (served but not in contract)")

    gen_schemas: Schema = generated.get("components", {}).get("schemas", {})
    for name, schema in contract.get("components", {}).get("schemas", {}).items():
        if name not in gen_schemas:
            problems.append(f"missing schema {name}")
        else:
            compare(name, schema, gen_schemas[name], c, g, problems)
    return problems


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")  # ✗/✓ on Windows consoles
    contract = yaml.safe_load(CONTRACT_FILE.read_text(encoding="utf-8"))
    generated = create_app().openapi()
    problems = check(contract, generated)
    for problem in problems:
        print(f"✗ {problem}")
    if problems:
        print(f"\n{len(problems)} contract drift item(s) vs {CONTRACT_FILE.name}")
        return 1
    print(f"✓ app matches {CONTRACT_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
