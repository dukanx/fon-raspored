import json
import os
import subprocess
import sys
from datetime import date, timedelta
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
# Spisak novih rokova koje send_push.mjs šalje kao notifikacije (efemerno u CI-ju).
PENDING_NOTIFY_FILE = SCRIPTS_DIR / 'pending_notify.json'
# Zadrži rokove kojima je makar jedan termin u poslednjih BUFFER_DANA (ili u budućnosti).
BUFFER_DANA = 30


def set_commit_msg(msg):
    github_env = os.environ.get('GITHUB_ENV')
    if github_env:
        with open(github_env, 'a') as f:
            f.write(f'COMMIT_MSG={msg}\n')
    else:
        print(f'Commit msg: {msg}')


def prune_rokovi():
    """Izbaci stare rokove (svi termini stariji od danas - BUFFER_DANA) i prazne rokove.
    Vraća listu imena obrisanih rokova."""
    if not ROKOVI_FILE.exists():
        return []
    data = json.loads(ROKOVI_FILE.read_text(encoding='utf-8'))
    cutoff = (date.today() - timedelta(days=BUFFER_DANA)).isoformat()
    kept, removed = [], []
    for r in data:
        dates = [e['date'] for e in r.get('entries', []) if e.get('date')]
        if not dates or max(dates) < cutoff:
            removed.append(r.get('rok', '?'))
        else:
            kept.append(r)
    if removed:
        ROKOVI_FILE.write_text(json.dumps(kept, indent=2, ensure_ascii=False), encoding='utf-8')
    return removed


def main():
    known = json.loads(KNOWN_FILE.read_text(encoding='utf-8')) if KNOWN_FILE.exists() else []
    new_known = list(known)

    new_pdfs = 0
    total_entries = 0
    new_roks = []
    errors = []

    for tip, url in PAGES.items():
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
            rok_name = None
            for line in result.stdout.splitlines():
                if line.startswith('Gotovo:'):
                    try:
                        count = int(line.split(':')[1].strip().split()[0])
                        total_entries += count
                    except Exception:
                        pass
                    if "'" in line:
                        rok_name = line.split("'")[1]

            new_roks.append({'rok': rok_name or pdf_name, 'tip': tip})
            new_known.append(href)
            new_pdfs += 1

    if new_known != known:
        KNOWN_FILE.write_text(json.dumps(new_known, indent=2, ensure_ascii=False), encoding='utf-8')

    if errors:
        print(f'\nGreške ({len(errors)}): {", ".join(errors)}')

    # Čišćenje starih/praznih rokova radi se uvek (i kad nema novih PDF-ova).
    pruned = prune_rokovi()
    if pruned:
        print(f'Obrisano {len(pruned)} starih/praznih rokova: {", ".join(pruned)}')

    if new_pdfs == 0:
        if pruned:
            set_commit_msg(f'auto: očišćeno {len(pruned)} starih rokova')
        print('Nema novih PDF-ova.')
        return

    # Zapiši nove rokove da ih send_push.mjs pošalje kao notifikacije.
    PENDING_NOTIFY_FILE.write_text(
        json.dumps(new_roks, indent=2, ensure_ascii=False), encoding='utf-8'
    )

    commit_msg = f'auto: {new_pdfs} novi PDF{"" if new_pdfs == 1 else "-a"}, {total_entries} unosa'
    if pruned:
        commit_msg += f' (+ očišćeno {len(pruned)} starih)'
    set_commit_msg(commit_msg)


if __name__ == '__main__':
    main()
