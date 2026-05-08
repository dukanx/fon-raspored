import json
import os
import subprocess
import sys
from pathlib import Path
import requests
from bs4 import BeautifulSoup

PAGES = {
    'kolokvijum': 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/',
    'ispit':      'https://oas.fon.bg.ac.rs/raspored-ispita/',
}

SCRIPTS_DIR = Path(__file__).parent
KNOWN_FILE  = SCRIPTS_DIR / 'known_pdfs.json'
ROKOVI_FILE = SCRIPTS_DIR.parent / 'public' / 'data' / 'rokovi.json'
MERGE_SCRIPT = SCRIPTS_DIR / 'merge_rok.py'


def main():
    known = json.loads(KNOWN_FILE.read_text(encoding='utf-8')) if KNOWN_FILE.exists() else []
    new_known = list(known)

    new_pdfs = 0
    total_entries = 0
    errors = []

    for _, url in PAGES.items():
        print(f'Checking {url}...')
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
        except Exception as e:
            print(f'  GREŠKA pri dohvatanju stranice: {e}')
            continue

        soup = BeautifulSoup(resp.text, 'html.parser')

        for a in soup.find_all('a', href=True):
            href = a['href']
            if not href.lower().endswith('.pdf') or href in known:
                continue

            print(f'  NOVO: {href}')
            new_known.append(href)

            pdf_name = href.split('/')[-1]
            pdf_path = Path(f'/tmp/{pdf_name}')

            try:
                pdf_path.write_bytes(requests.get(href, timeout=30).content)
            except Exception as e:
                print(f'  GREŠKA pri preuzimanju: {e}')
                errors.append(href)
                continue

            result = subprocess.run(
                [sys.executable, str(MERGE_SCRIPT), str(pdf_path), '--rokovi', str(ROKOVI_FILE)],
                capture_output=True, text=True
            )

            if result.returncode != 0:
                print(f'  GREŠKA u merge_rok.py:\n{result.stderr}')
                errors.append(href)
                continue

            print(result.stderr.strip())

            # "Gotovo: N unosa u 'rok name'."
            for line in result.stdout.splitlines():
                if line.startswith('Gotovo:'):
                    try:
                        count = int(line.split(':')[1].strip().split()[0])
                        total_entries += count
                    except Exception:
                        pass

            new_pdfs += 1

    KNOWN_FILE.write_text(json.dumps(new_known, indent=2, ensure_ascii=False), encoding='utf-8')

    if errors:
        print(f'\nGreške ({len(errors)}): {", ".join(errors)}')

    if new_pdfs == 0:
        print('Nema novih PDF-ova.')
        commit_msg = 'auto: nema novih PDF-ova'
    else:
        commit_msg = f'auto: {new_pdfs} novi PDF{"" if new_pdfs == 1 else "-a"}, {total_entries} unosa'

    github_env = os.environ.get('GITHUB_ENV')
    if github_env:
        with open(github_env, 'a') as f:
            f.write(f'COMMIT_MSG={commit_msg}\n')
    else:
        print(f'Commit msg: {commit_msg}')


if __name__ == '__main__':
    main()
