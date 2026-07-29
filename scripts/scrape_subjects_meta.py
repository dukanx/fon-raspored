#!/usr/bin/env python3
"""Scrape metapodataka predmeta sa oas.fon.bg.ac.rs.

Za svaki jedinstven predmet iz public/data/{1..4}god.json pokušava da nađe
stranicu predmeta na FON sajtu i izvuče:
  - ESPB bodove (i modul-zavisne, npr. "MiO - 6, IST - 5")
  - katedru
  - verifikovan link (URL koji je stvarno vratio 200)

Rezultat se upisuje u public/data/subjects-meta.json, ključ = naziv predmeta.
Panel predmeta na /raspored čita ovaj fajl. Pokretanje:

    cd scripts && python scrape_subjects_meta.py

Napomena: profesori se NE nalaze na stranicama predmeta pa se ne skupljaju.
"""
import json, os, re, time, html, urllib.request, urllib.error

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'public', 'data')

# Većina predmeta ima /predmet-<slug>/; jezici imaju /<slug>/ bez prefiksa.
URL_PATTERNS = [
    "https://oas.fon.bg.ac.rs/predmet-{}/",
    "https://oas.fon.bg.ac.rs/{}/",
]

# Predmeti čiji se naziv u rasporedu razlikuje od naziva stranice (preimenovani).
# Ključ = naziv iz rasporeda, vrednost = tačan URL stranice.
URL_OVERRIDES = {
    'Mikroservisna arhitektura IS':
        'https://oas.fon.bg.ac.rs/mikroservisna-arhitektura-informacionih-sistema/',
    'Internet marketing':
        'https://oas.fon.bg.ac.rs/predmet-internet-marketing-i-drustveni-mediji/',
}

SLUG_DIA = str.maketrans({
    'č': 'c', 'ć': 'c', 'š': 's', 'ž': 'z', 'đ': 'dj',
    'Č': 'c', 'Ć': 'c', 'Š': 's', 'Ž': 'z', 'Đ': 'dj',
})

# Ćirilica -> srpska latinica (digrafi prvo).
CYR = [
    ('Љ', 'Lj'), ('Њ', 'Nj'), ('Џ', 'Dž'), ('љ', 'lj'), ('њ', 'nj'), ('џ', 'dž'),
    ('А', 'A'), ('Б', 'B'), ('В', 'V'), ('Г', 'G'), ('Д', 'D'), ('Ђ', 'Đ'), ('Е', 'E'),
    ('Ж', 'Ž'), ('З', 'Z'), ('И', 'I'), ('Ј', 'J'), ('К', 'K'), ('Л', 'L'), ('М', 'M'),
    ('Н', 'N'), ('О', 'O'), ('П', 'P'), ('Р', 'R'), ('С', 'S'), ('Т', 'T'), ('Ћ', 'Ć'),
    ('У', 'U'), ('Ф', 'F'), ('Х', 'H'), ('Ц', 'C'), ('Ч', 'Č'), ('Ш', 'Š'),
    ('а', 'a'), ('б', 'b'), ('в', 'v'), ('г', 'g'), ('д', 'd'), ('ђ', 'đ'), ('е', 'e'),
    ('ж', 'ž'), ('з', 'z'), ('и', 'i'), ('ј', 'j'), ('к', 'k'), ('л', 'l'), ('м', 'm'),
    ('н', 'n'), ('о', 'o'), ('п', 'p'), ('р', 'r'), ('с', 's'), ('т', 't'), ('ћ', 'ć'),
    ('у', 'u'), ('ф', 'f'), ('х', 'h'), ('ц', 'c'), ('ч', 'č'), ('ш', 'š'),
]


def to_latin(s):
    if not s:
        return s
    for c, l in CYR:
        s = s.replace(c, l)
    return s


def slugify(name):
    s = name.translate(SLUG_DIA).lower()
    s = re.sub(r'[^a-z0-9]+', '-', s)
    return s.strip('-')


def variants(name):
    seen = []
    def add(x):
        if x and x not in seen:
            seen.append(x)
    add(slugify(name))
    no_paren = re.sub(r'\([^)]*\)', '', name).strip()
    add(slugify(no_paren))
    add(slugify(re.sub(r'\s+\d+\s*$', '', no_paren)))
    return seen


def fetch(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            if r.status == 200:
                return r.read().decode('utf-8', 'replace')
    except (urllib.error.HTTPError, Exception):
        return None
    return None


def parse(raw):
    text = re.sub(r'<[^>]+>', ' ', raw)
    text = re.sub(r'\s+', ' ', html.unescape(text))
    espb = None
    m = re.search(r'Број ЕСПБ бодова\s+([0-9]{1,2})(?=\s)', text)
    if m:
        espb = m.group(1)
    else:
        m = re.search(r'Број ЕСПБ бодова\s+(.{1,45}?)\s*(?:Циљ|Исход|Модул|Статус)', text)
        if m:
            espb = re.sub(r'\s+', ' ', to_latin(m.group(1))).strip(' ,-')
    katedra = None
    m = re.search(r'Катедра\s+(Катедра[^0-9]*?)\s*(?:Број ЕСПБ|Модул|Статус|Циљ)', text)
    if m:
        katedra = to_latin(re.sub(r'\s+', ' ', m.group(1)).strip())
    # Status: "Obavezan predmet" / "Izborni predmet" ili modul-zavisno
    # "IST - Obavezan predmet, MiO - Izborni predmet".
    status = None
    m = re.search(r'Статус предмета\s+(.{1,90}?)\s*(?:Катедра|Број ЕСПБ|Циљ|Модул|Исход)', text)
    if m:
        status = to_latin(re.sub(r'\s+', ' ', m.group(1)).strip())
    return espb, katedra, status


def collect_subjects():
    names = set()
    for y in (1, 2, 3, 4):
        path = os.path.join(DATA, f'{y}god.json')
        if not os.path.exists(path):
            continue
        d = json.load(open(path, encoding='utf-8'))
        for e in d.get('entries', []):
            if e.get('subject'):
                names.add(e['subject'])
    return sorted(names, key=lambda s: s.lower())


def candidate_urls(name):
    if name in URL_OVERRIDES:
        return [URL_OVERRIDES[name]]
    urls = []
    for slug in variants(name):
        for pat in URL_PATTERNS:
            urls.append(pat.format(slug))
    return urls


def main():
    subjects = collect_subjects()
    dest = os.path.join(DATA, 'subjects-meta.json')
    # Merge-safe: postojeći unosi se zadrže ako scrape promaši (mrežni prekid).
    out = {}
    if os.path.exists(dest):
        out = json.load(open(dest, encoding='utf-8'))
    miss = []
    for i, name in enumerate(subjects, 1):
        found = None
        for url in candidate_urls(name):
            raw = fetch(url)
            if raw:
                espb, katedra, status = parse(raw)
                found = {'url': url, 'espb': espb, 'katedra': katedra, 'status': status}
                break
            time.sleep(0.12)
        if found:
            out[name] = found
            print(f"[{i:3}/{len(subjects)}] OK   {name[:40]:40} status={found['status']}", flush=True)
        elif name in out:
            print(f"[{i:3}/{len(subjects)}] KEEP {name[:40]:40} (zadržan stari unos)", flush=True)
        else:
            miss.append(name)
            print(f"[{i:3}/{len(subjects)}] MISS {name}", flush=True)
        time.sleep(0.08)
    json.dump(out, open(dest, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, sort_keys=True)
    print(f"\nHIT/KEEP {len(out)}/{len(subjects)}  MISS: {miss}\n-> {dest}")


if __name__ == '__main__':
    main()
