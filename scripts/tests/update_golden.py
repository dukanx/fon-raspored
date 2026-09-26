#!/usr/bin/env python3
"""Regeneriše golden .expected.json fajlove iz PDF i Word fixtures.

Pokreni SAMO kad je promena u parseru namerna i kad si ručno proverio da je
novi izlaz tačan:

    cd scripts && python tests/update_golden.py

Pa pregledaj `git diff` na *.expected.json pre commit-a.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fon_docx
import fon_exam_parser as parser
import fon_parser

FIXTURES = Path(__file__).parent / "fixtures"

CASES = [
    ("ispit_feb", parser.parse_ispit),
    ("kolokvijum_drugi_zimski", parser.parse_kolokvijum),
]


# Raspored nastave iz Word-a (zimski 2026/27): v. test_fon_docx.py.
DOCX_DIR = FIXTURES / "nastava_docx"
DOCX_YEARS = (1, 2, 3, 4)


def parse_docx_year(y):
    groups = fon_docx.parse_groups(str(DOCX_DIR / f"grupe_{y}god_zimski_2026.docx"))
    lines = fon_docx.extract_lines(str(DOCX_DIR / f"raspored_{y}god_zimski_2026.docx"))
    return {"groups": groups, "entries": fon_parser.parse_schedule_lines(lines, groups)}


def main():
    for y in DOCX_YEARS:
        out = DOCX_DIR / f"{y}god_zimski_2026.expected.json"
        res = parse_docx_year(y)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(res, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"docx {y}. god: {len(res['entries'])} termina -> {out.name}")

    for name, parse_fn in CASES:
        entries = parse_fn(str(FIXTURES / f"{name}.pdf"))
        out = FIXTURES / f"{name}.expected.json"
        with open(out, "w", encoding="utf-8") as f:
            json.dump(entries, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"{name}: {len(entries)} unosa -> {out.name}")


if __name__ == "__main__":
    main()
