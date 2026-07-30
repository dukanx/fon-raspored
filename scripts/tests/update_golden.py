#!/usr/bin/env python3
"""Regeneriše golden .expected.json fajlove iz PDF fixtures.

Pokreni SAMO kad je promena u parseru namerna i kad si ručno proverio da je
novi izlaz tačan:

    cd scripts && python tests/update_golden.py

Pa pregledaj `git diff` na *.expected.json pre commit-a.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fon_exam_parser as parser

FIXTURES = Path(__file__).parent / "fixtures"

CASES = [
    ("ispit_feb", parser.parse_ispit),
    ("kolokvijum_drugi_zimski", parser.parse_kolokvijum),
]


def main():
    for name, parse_fn in CASES:
        entries = parse_fn(str(FIXTURES / f"{name}.pdf"))
        out = FIXTURES / f"{name}.expected.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{name}: {len(entries)} unosa -> {out.name}")


if __name__ == "__main__":
    main()
