"""Write the app's generated OpenAPI document to ``../contracts/openapi_v1.generated.json``.

Usage (from backend/): ``make openapi`` or ``uv run python scripts/export_openapi.py``.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))  # scripts/ is not a package; make `app` importable

from app.main import create_app  # noqa: E402

OUTPUT = BACKEND_DIR.parent / "contracts" / "openapi_v1.generated.json"


def main() -> int:
    spec = create_app().openapi()
    OUTPUT.write_text(json.dumps(spec, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"wrote {OUTPUT} ({len(spec.get('paths', {}))} paths, "
        f"{len(spec.get('components', {}).get('schemas', {}))} schemas)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
