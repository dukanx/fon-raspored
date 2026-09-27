#!/usr/bin/env python3
"""
Provera rasporeda nastave (public/data/{1..4}god.json) pre objave.

Dve vrste nalaza:
  - GREŠKA: čitanje je pošlo naopako (termin bez grupe, nepostojeća grupa,
    loše vreme, prazan raspored, semestri se ne slažu). Takav raspored se ne
    objavljuje automatski (update-nastava.yml otvara PR).
  - UPOZORENJE: čudnost u samim FON podacima (opsezi prezimena se preklapaju,
    predmet kog nema u planu modula, predmet bez statusa). Raspored se objavi,
    jer je to ono što je FON objavio, a nalazi idu u GitHub issue.

Pokretanje:
    python scripts/validate_data.py                      # izveštaj na stdout
    python scripts/validate_data.py --report izvestaj.md # i u fajl (markdown)
Izlazni kod 1 ako ima grešaka, inače 0.
"""

import argparse
import json
import re
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
DATA_DIR = SCRIPTS_DIR.parent / "public" / "data"
DAYS = {"Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota"}
TIME = re.compile(r"^\d{2}:\d{2}$")
SEMESTER = re.compile(r"^(Zimski|Letnji) \d{4}/\d{2}$")
ISIT_MODULES = {
    "Informacione tehnologije", "Informacioni sistemi", "Informaciono inženjerstvo",
    "Poslovna analitika", "Softversko inženjerstvo", "Tehnologije elektronskog poslovanja",
}

# Isti redosled slova kao aplikacija (lib/schedule.ts): srpska azbuka.
_SR = {
    "a": "01", "b": "02", "v": "03", "g": "04", "d": "05", "đ": "06", "dj": "06",
    "e": "07", "ž": "08", "zh": "08", "z": "09", "i": "10", "j": "11", "k": "12",
    "l": "13", "lj": "14", "m": "15", "n": "16", "nj": "17", "o": "18", "p": "19",
    "r": "20", "s": "21", "t": "22", "ć": "23", "cy": "23", "cj": "23", "u": "24",
    "f": "25", "h": "26", "c": "27", "č": "28", "ch": "28", "dž": "29", "dz": "29",
    "š": "30", "sh": "30",
}


def name_key(name):
    s, out, i = name.lower(), [], 0
    while i < len(s):
        if s[i:i + 2] in _SR:
            out.append(_SR[s[i:i + 2]])
            i += 2
        else:
            out.append(_SR.get(s[i], s[i]))
            i += 1
    return "".join(out)


def _bound(name, is_end):
    """Granica opsega kao ključ za poređenje. "X-" znači od početka slova X,
    odnosno (kao kraj) sva prezimena na X."""
    if name.endswith("-"):
        k = name_key(name[:-1])
        return k + "~" if is_end else k
    return name_key(name)


def norm_subject(s):
    s = re.sub(r"\(na\)", "", s.lower())
    return " ".join(re.sub(r"[^\w]+", " ", s).replace("_", " ").split())


def plan_status(plan, program, year, sem, subject):
    """Isto kao planStatus u lib/plan.ts: 'obavezan' | 'izborni' | None."""
    mods = [plan[program]] if program in plan else [m for m in plan.values() if m.get("program") == program]
    n = norm_subject(subject)
    has = lambda lst: any(norm_subject(x) == n for x in lst)

    def status_in(s_key):
        sems = [m["godine"].get(str(year), {}).get(s_key) for m in mods]
        sems = [s for s in sems if s]
        if not sems:
            return None
        if all(has(s["obavezni"]) for s in sems):
            return "obavezan"
        return "izborni" if any(has(s["obavezni"]) or has(s["izborni"]) for s in sems) else None

    return status_in(sem) or status_in("letnji" if sem == "zimski" else "zimski")


def check_ranges(year, groups, warn):
    """Opsezi prezimena po programu: od <= do, bez preklapanja susednih."""
    by_prog = {}
    for gid, g in groups.items():
        if g.get("range", "Svi") == "Svi":
            continue
        parts = g["range"].split(" - ")
        if len(parts) != 2:
            warn(f"{year}. god {gid}: opseg prezimena '{g['range']}' nije u obliku 'od - do'")
            continue
        by_prog.setdefault(g["program"], []).append((gid, parts[0], parts[1]))
    for prog, rs in by_prog.items():
        rs.sort(key=lambda r: _bound(r[1], False))
        for gid, frm, to in rs:
            if _bound(frm, False) > _bound(to, True):
                warn(f"{year}. god {gid} ({prog}): opseg '{frm} - {to}' je naopačke")
        for (g1, _, to1), (g2, frm2, _) in zip(rs, rs[1:]):
            if _bound(to1, True) >= _bound(frm2, False):
                warn(f"{year}. god {prog}: opsezi {g1} (do '{to1}') i {g2} (od '{frm2}') se preklapaju")


def validate(data_dir=DATA_DIR, years=(1, 2, 3, 4)):
    errors, warnings, info = [], [], []
    err, warn = errors.append, warnings.append

    datas = {}
    for y in years:
        p = Path(data_dir) / f"{y}god.json"
        try:
            datas[y] = json.loads(p.read_text(encoding="utf-8"))
        except Exception as e:  # noqa: BLE001
            err(f"{y}god.json se ne može pročitati: {e}")
    if errors:
        return errors, warnings, info

    semesters = {d.get("semester") for d in datas.values()}
    if len(semesters) != 1:
        err(f"godine nemaju isti semestar: {sorted(map(str, semesters))}")
    semester = next(iter(semesters))
    if not SEMESTER.match(str(semester)):
        err(f"nepoznat format semestra: '{semester}'")
    sem_key = str(semester).split(" ")[0].lower()

    try:
        plan = json.loads((Path(data_dir) / "plan.json").read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        plan = {}
        warn("plan.json ne postoji ili se ne može pročitati - obavezni/izborni se ne proveravaju")
    try:
        meta = json.loads((Path(data_dir) / "subjects-meta.json").read_text(encoding="utf-8"))
    except Exception:  # noqa: BLE001
        meta = {}

    for y, d in datas.items():
        groups, entries = d.get("groups", {}), d.get("entries", [])
        if d.get("year") != y:
            err(f"{y}god.json: polje year je {d.get('year')}")
        if not groups:
            err(f"{y}. god: nema nijedne grupe")
        if not entries:
            err(f"{y}. god: nema nijednog termina")

        for i, e in enumerate(entries):
            where = f"{y}. god, {e.get('day')} {e.get('start')} {e.get('subject')}"
            if e.get("day") not in DAYS:
                err(f"{where}: nepoznat dan")
            if not (TIME.match(str(e.get("start"))) and TIME.match(str(e.get("end")))):
                err(f"{where}: loše vreme '{e.get('start')}-{e.get('end')}'")
            elif e["start"] >= e["end"]:
                err(f"{where}: početak nije pre kraja")
            if not e.get("subject", "").strip():
                err(f"{y}. god, termin {i}: bez naziva predmeta")
            if e.get("type_short") not in ("P", "V"):
                err(f"{where}: tip nije P ni V")
            if not e.get("groups"):
                err(f"{where}: termin bez ijedne grupe")
            # FON uz termin navodi i grupe drugih godina koje slušaju isti
            # predmet (D6 u rasporedu 3. godine), pa greška je samo nepostojeća
            # grupa ove godine (A za 1., B za 2., C za 3., D za 4.).
            prefix = "ABCD"[y - 1]
            unknown = {g for g in e.get("groups", []) if g.startswith(prefix)} - set(groups)
            if unknown:
                err(f"{where}: nepostojeće grupe {sorted(unknown)}")
            if not any(g in groups for g in e.get("groups", [])):
                err(f"{where}: nijedna grupa iz ove godine")

        used = {g for e in entries for g in e.get("groups", [])}
        for gid in sorted(set(groups) - used):
            err(f"{y}. god {gid}: grupa nema nijedan termin")

        check_ranges(y, groups, warn)

        # Predmeti prema planu modula (isto što koristi izbor predmeta).
        if plan:
            missing = {}
            for gid, g in groups.items():
                prog = g["program"]
                for s in {e["subject"] for e in entries if gid in e["groups"]}:
                    if plan_status(plan, prog, y, sem_key, s) is None:
                        missing.setdefault(s, set()).add(prog)
            for s, progs in sorted(missing.items()):
                has_meta = bool(meta.get(s, {}).get("status"))
                warn(f"{y}. god: '{s}' nije u planu modula ({', '.join(sorted(progs))})"
                     + ("" if has_meta else " i nema status predmeta, pa počinje nečekiran"))

        n_subj = len({e['subject'] for e in entries})
        info.append(f"{y}. god: {len(groups)} grupa, {len(entries)} termina, {n_subj} predmeta")

    return errors, warnings, info


def report(errors, warnings, info):
    lines = ["## Provera rasporeda nastave", ""]
    lines += [f"- {x}" for x in info] + [""]
    if errors:
        lines += [f"### Greške ({len(errors)}) - raspored se ne objavljuje automatski", ""]
        lines += [f"- {x}" for x in errors] + [""]
    if warnings:
        lines += [f"### Upozorenja ({len(warnings)})", ""]
        lines += [f"- {x}" for x in warnings] + [""]
    if not errors and not warnings:
        lines += ["Sve u redu.", ""]
    return "\n".join(lines)


def main():
    ap = argparse.ArgumentParser(description="Provera rasporeda nastave pre objave.")
    ap.add_argument("--data", default=str(DATA_DIR), help="Folder sa god.json fajlovima")
    ap.add_argument("--report", help="Upiši izveštaj (markdown) i u ovaj fajl")
    args = ap.parse_args()

    errors, warnings, info = validate(args.data)
    text = report(errors, warnings, info)
    print(text)
    if args.report:
        Path(args.report).write_text(text, encoding="utf-8")
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
