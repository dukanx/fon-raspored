import json
import subprocess
from pathlib import Path
import requests
from bs4 import BeautifulSoup

PAGES = {
    'kolokvijum': 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/',
    'ispit':      'https://oas.fon.bg.ac.rs/raspored-ispita/',
}

KNOWN_FILE = Path('scripts/known_pdfs.json')
ROKOVI_FILE = Path('public/data/rokovi.json')
PARSER      = Path('scripts/parse_exams.py')

# Mapiranje ključnih reči u naziv roka
def guess_rok(url: str, tip: str) -> str:
    url_lower = url.lower()
    if 'prvi' in url_lower and 'zimski' in url_lower:   return 'Prvi zimski kolokvijum'
    if 'drugi' in url_lower and 'zimski' in url_lower:  return 'Drugi zimski kolokvijum'
    if 'prvi' in url_lower and 'letnji' in url_lower:   return 'Prvi letnji kolokvijum'
    if 'drugi' in url_lower and 'letnji' in url_lower:  return 'Drugi letnji kolokvijum'
    if 'jan' in url_lower:  return 'Januarski ispitni rok'
    if 'feb' in url_lower:  return 'Februarski ispitni rok'
    if 'jun' in url_lower:  return 'Junski ispitni rok'
    if 'jul' in url_lower:  return 'Julski ispitni rok'
    if 'sep' in url_lower:  return 'Septembarski ispitni rok'
    if 'okt' in url_lower:  return 'Oktobarski ispitni rok'
    return url.split('/')[-1].replace('.pdf', '').replace('-', ' ')

def merge_into_rokovi(new_rok: dict):
    """Dodaje ili zamenjuje rok u rokovi.json na osnovu polja 'rok'."""
    rokovi = json.loads(ROKOVI_FILE.read_text(encoding='utf-8')) if ROKOVI_FILE.exists() else []
    # Zameni ako već postoji isti rok (npr. ispravka PDF-a)
    rokovi = [r for r in rokovi if r.get('rok') != new_rok['rok']]
    rokovi.append(new_rok)
    # Sortiraj: ispiti pre kolokvijuma, pa hronološki po prvom datumu unosa
    def sort_key(r):
        first_date = r['entries'][0]['date'] if r['entries'] else '9999'
        return (0 if r['tip'] == 'ispit' else 1, first_date)
    rokovi.sort(key=sort_key)
    ROKOVI_FILE.write_text(json.dumps(rokovi, ensure_ascii=False, indent=2), encoding='utf-8')


def main():
    known = json.loads(KNOWN_FILE.read_text(encoding='utf-8')) if KNOWN_FILE.exists() else []
    new_known = list(known)
    found_new = False

    for tip, url in PAGES.items():
        print(f'Checking {url}...')
        resp = requests.get(url, timeout=15)
        soup = BeautifulSoup(resp.text, 'html.parser')

        for a in soup.find_all('a', href=True):
            href = a['href']
            if not href.endswith('.pdf'):
                continue
            if href in known:
                continue

            # Novi PDF!
            print(f'  NEW: {href}')
            found_new = True
            new_known.append(href)

            # Preuzmi PDF
            pdf_name = href.split('/')[-1]
            pdf_path = Path(f'/tmp/{pdf_name}')
            pdf_path.write_bytes(requests.get(href, timeout=30).content)

            rok = guess_rok(href, tip)

            # Pokreni parser — bez --output, čitamo stdout
            result = subprocess.run(
                ['python', str(PARSER), '--pdf', str(pdf_path), '--tip', tip, '--rok', rok],
                capture_output=True, text=True, check=True
            )
            new_rok = json.loads(result.stdout)
            merge_into_rokovi(new_rok)
            print(f'  Merged -> {ROKOVI_FILE} ({len(new_rok["entries"])} unosa)')

    KNOWN_FILE.write_text(json.dumps(new_known, indent=2, ensure_ascii=False), encoding='utf-8')

    if not found_new:
        print('No new PDFs found.')

if __name__ == '__main__':
    main()