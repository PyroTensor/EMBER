"""Diff ``contracts/openapi_v1.yaml`` (the contract) against ``create_app().openapi()`` (what we serve).

Reports, as ``✗`` lines:
  * operations (method + path) in the contract that the app does not serve,
  * component schemas in the contract that the app does not define,
  * fields of contract schemas (components, request bodies, 200 responses) that are missing in the app,
  * fields the contract marks required that the app leaves optional.
``$ref`` (including the external ``schema_v1.json``), ``allOf`` and nullable ``anyOf`` are resolved; nested
objects and array items are compared recursively. Descriptions, enums, bounds, extra fields and extra
endpoints are ignored. Exit code 1 on drift, 0 when the app covers the contract.

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
    """Record fields/required-ness present in the contract schema ``want`` but missing in ``have``."""
    if depth > MAX_DEPTH:
        return
    w, h = c.resolve(want), g.resolve(have)
    if not w:
        return
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
    h_required = set(h.get("required", []))
    for name in w.get("required", []):
        if name in h_props and name not in h_required:
            problems.append(f"{where}.{name}: should be required")
    for name, sub in w_props.items():
        if name not in h_props:
            problems.append(f"{where}.{name}: missing field")
        else:
            compare(f"{where}.{name}", sub, h_props[name], c, g, problems, depth + 1)


def _json_schema(container: Schema | None) -> Schema | None:
    if not container:
        return None
    schema: Schema | None = container.get("content", {}).get("application/json", {}).get("schema")
    return schema


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
    print(f"✓ app covers {CONTRACT_FILE.name}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
