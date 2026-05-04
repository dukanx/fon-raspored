import json
import os
import subprocess
from pathlib import Path
import requests
from bs4 import BeautifulSoup

PAGES = {
    'kolokvijum': 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/',
    'ispit':      'https://oas.fon.bg.ac.rs/raspored-ispita/',
}

KNOWN_FILE  = Path('scripts/known_pdfs.json')
ROKOVI_FILE = Path('public/data/rokovi.json')
PARSER      = Path('scripts/fon_exam_parser.py')


def guess_rok(url: str) -> str:
    u = url.lower()
    if 'prvi'  in u and 'zimski' in u: return 'Prvi zimski kolokvijum'
    if 'drugi' in u and 'zimski' in u: return 'Drugi zimski kolokvijum'
    if 'prvi'  in u and 'letnji' in u: return 'Prvi letnji kolokvijum'
    if 'drugi' in u and 'letnji' in u: return 'Drugi letnji kolokvijum'
    if 'jan' in u: return 'Januarski ispitni rok'
    if 'feb' in u: return 'Februarski ispitni rok'
    if 'jun' in u: return 'Junski ispitni rok'
    if 'jul' in u: return 'Julski ispitni rok'
    if 'sep' in u: return 'Septembarski ispitni rok'
    if 'okt' in u: return 'Oktobarski ispitni rok'
    return url.split('/')[-1].replace('.pdf', '').replace('-', ' ')


def merge_into_rokovi(new_rok: dict):
    rokovi = json.loads(ROKOVI_FILE.read_text(encoding='utf-8')) if ROKOVI_FILE.exists() else []
    rokovi = [r for r in rokovi if r.get('rok') != new_rok['rok']]
    rokovi.append(new_rok)
    def sort_key(r):
        first_date = r['entries'][0]['date'] if r['entries'] else '9999'
        return (0 if r['tip'] == 'ispit' else 1, first_date)
    rokovi.sort(key=sort_key)
    ROKOVI_FILE.write_text(json.dumps(rokovi, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    known = json.loads(KNOWN_FILE.read_text(encoding='utf-8')) if KNOWN_FILE.exists() else []
    new_known = list(known)

    new_pdfs = 0
    total_entries = 0

    for tip, url in PAGES.items():
        print(f'Checking {url}...')
        resp = requests.get(url, timeout=15)
        soup = BeautifulSoup(resp.text, 'html.parser')

        for a in soup.find_all('a', href=True):
            href = a['href']
            if not href.endswith('.pdf') or href in known:
                continue

            print(f'  NEW: {href}')
            new_known.append(href)

            pdf_name = href.split('/')[-1]
            pdf_path = Path(f'/tmp/{pdf_name}')
            pdf_path.write_bytes(requests.get(href, timeout=30).content)

            rok = guess_rok(href)

            result = subprocess.run(
                ['python', str(PARSER), '--pdf', str(pdf_path), '--tip', tip, '--rok', rok],
                capture_output=True, text=True, check=True
            )
            new_rok = json.loads(result.stdout)
            count = len(new_rok['entries'])

            if count == 0:
                print(f'  WARNING: 0 unosa iz {pdf_name} — PDF format možda nije podržan', flush=True)
            else:
                merge_into_rokovi(new_rok)
                print(f'  Merged {count} unosa -> {ROKOVI_FILE}')
                total_entries += count

            new_pdfs += 1

    KNOWN_FILE.write_text(json.dumps(new_known, indent=2, ensure_ascii=False), encoding='utf-8')

    if new_pdfs == 0:
        print('No new PDFs found.')
        commit_msg = 'auto: nema novih PDF-ova'
    else:
        commit_msg = f'auto: {new_pdfs} novi PDF{"" if new_pdfs == 1 else "-a"}, {total_entries} unosa'

    # Postavi commit poruku kao env varijablu za workflow
    github_env = os.environ.get('GITHUB_ENV')
    if github_env:
        with open(github_env, 'a') as f:
            f.write(f'COMMIT_MSG={commit_msg}\n')
    else:
        print(f'Commit msg: {commit_msg}')


if __name__ == '__main__':
    main()
