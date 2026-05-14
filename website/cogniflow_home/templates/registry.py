"""
Template Registry — auto-discovers every t##_*.py module in this package
and exposes helpers to list, search, and retrieve templates.
"""

from __future__ import annotations

import importlib
import pkgutil
from pathlib import Path
from typing import Dict, List, Optional

_TEMPLATES: Dict[str, dict] = {}
_loaded = False


def _load_all() -> None:
    """Import every t*_ module in the templates package and collect TEMPLATE dicts."""
    global _loaded
    if _loaded:
        return

    package_dir = Path(__file__).resolve().parent
    for finder, module_name, _is_pkg in pkgutil.iter_modules([str(package_dir)]):
        if not module_name.startswith("t"):
            continue
        mod = importlib.import_module(f".{module_name}", package=__package__)
        tmpl = getattr(mod, "TEMPLATE", None)
        if tmpl and isinstance(tmpl, dict) and "id" in tmpl:
            _TEMPLATES[tmpl["id"]] = tmpl

    _loaded = True


# ── public API ───────────────────────────────────────────────────────

def list_templates() -> List[dict]:
    """Return all templates sorted by id."""
    _load_all()
    return sorted(_TEMPLATES.values(), key=lambda t: t["id"])


def get_template(template_id: str) -> Optional[dict]:
    """Return a single template by id, or None."""
    _load_all()
    return _TEMPLATES.get(template_id)


def search_templates(
    *,
    industry: Optional[str] = None,
    tag: Optional[str] = None,
    difficulty: Optional[str] = None,
    language: Optional[str] = None,
    query: Optional[str] = None,
) -> List[dict]:
    """Filter templates by industry, tag, difficulty, language, or free-text query."""
    _load_all()
    results = list(_TEMPLATES.values())

    if industry:
        industry_lower = industry.lower()
        results = [t for t in results if industry_lower in t.get("industry", "").lower()]

    if tag:
        tag_lower = tag.lower()
        results = [t for t in results if tag_lower in [x.lower() for x in t.get("tags", [])]]

    if difficulty:
        results = [t for t in results if t.get("difficulty") == difficulty]

    if language:
        lang_lower = language.lower()
        results = [t for t in results if lang_lower in [x.lower() for x in t.get("languages", [])]]

    if query:
        q = query.lower()
        results = [
            t for t in results
            if q in t.get("name", "").lower()
            or q in t.get("description", "").lower()
            or q in t.get("use_case", "").lower()
            or any(q in tag.lower() for tag in t.get("tags", []))
        ]

    return sorted(results, key=lambda t: t["id"])


def template_ids() -> List[str]:
    """Return sorted list of all template ids."""
    _load_all()
    return sorted(_TEMPLATES.keys())
