import json
import os
import re
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

PAGES = {
    'kolokvijum': 'https://oas.fon.bg.ac.rs/raspored-kolokvijuma/',
    'ispit':      'https://oas.fon.bg.ac.rs/raspored-ispita/',
}

# Dokumenti koje FON može da objavi, a scraper ne čita (PDF i .docx čita).
NECITLJIV_RE = re.compile(r'\.(doc|xls|xlsx|odt|ods|rtf)$', re.IGNORECASE)


def verzija(odgovor):
    """Oznaka verzije fajla iz zaglavlja odgovora (None ako je server ne šalje)."""
    return odgovor.headers.get('Last-Modified') or odgovor.headers.get('ETag')

SCRIPTS_DIR = Path(__file__).parent
KNOWN_FILE  = SCRIPTS_DIR / 'known_pdfs.json'
# Last-Modified (ili ETag) svakog poznatog fajla. WordPress ume da zameni fajl
# pod istom adresom, pa bi bez ovoga izmenjen raspored ostao nepročitan.
VERZIJE_FILE = SCRIPTS_DIR / 'known_versions.json'
ROKOVI_FILE = SCRIPTS_DIR.parent / 'public' / 'data' / 'rokovi.json'
MERGE_SCRIPT = SCRIPTS_DIR / 'merge_rok.py'
# Spisak novih rokova koje send_push.mjs šalje kao notifikacije (efemerno u CI-ju).
PENDING_NOTIFY_FILE = SCRIPTS_DIR / 'pending_notify.json'
# PDF-ovi koji su skinuti, a nisu pročitani. check-fon.yml za svaki otvara
# GitHub issue: takav PDF se pokušava svaki dan i bez ovoga pada tiho
# (septembarski 2025/26 je danima padao zbog greške u kucanju u naslovu).
GRESKE_FILE = SCRIPTS_DIR / 'greske_citanja.json'
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
    verzije = json.loads(VERZIJE_FILE.read_text(encoding='utf-8')) if VERZIJE_FILE.exists() else {}
    nove_verzije = dict(verzije)

    new_pdfs = 0
    total_entries = 0
    new_roks = []
    errors = []
    greske = []  # nepročitani PDF-ovi -> GRESKE_FILE
    GRESKE_FILE.unlink(missing_ok=True)
    # Za razlikovanje "nema ničeg novog" (uredno) od "sajt se promenio" (kvar).
    stranica_ok = 0
    pdf_linkova = 0

    for tip, url in PAGES.items():
        print(f'Checking {url}...')
        try:
            resp = requests.get(url, timeout=15)
            resp.raise_for_status()
        except Exception as e:
            print(f'  GREŠKA pri dohvatanju stranice: {e}')
            continue

        stranica_ok += 1
        soup = BeautifulSoup(resp.text, 'html.parser')

        for a in soup.find_all('a', href=True):
            # Pun URL (i relativan link), a tip po putanji, bez ?parametara.
            href = urljoin(url, a['href'].strip())
            putanja = urlparse(href).path.lower()
            # Word (.docx) je isto: kolokvijume za zimski 2026/27 FON je objavio
            # samo tako, a scraper ih je danima preskakao jer je gledao samo PDF.
            # Dokument u formatu koji ne čitamo ide u issue, da ne bi opet prošlo tiho.
            if NECITLJIV_RE.search(putanja):
                if href not in known:
                    print(f'  NEPODRŽAN FORMAT: {href}')
                    greske.append({'pdf': href.split('/')[-1], 'url': href, 'razlog': 'format koji scraper ne ume da pročita'})
                continue
            if not putanja.endswith(('.pdf', '.docx')):
                continue
            # Broji se SVAKI link na raspored, ne samo nov. Ako ovih odjednom nema,
            # a ranije ih je bilo, promenio se sajt - v. proveru posle petlje.
            pdf_linkova += 1
            # Aplikacija prati aktuelni program (akreditacija 2022); ispiti po staroj
            # akreditaciji 2014 dolaze kao zaseban PDF i preskaču se. Kolokvijumi nemaju
            # podelu po akreditaciji (nema tokena '2014'), pa ostaju.
            if '2014' in href:
                if href not in known:
                    print(f'  Preskačem (akreditacija 2014): {href}')
                continue

            izmenjen = False
            if href in known:
                # Poznat fajl: čita se ponovo samo ako ga je FON zamenio pod istom adresom.
                try:
                    sada = verzija(requests.head(href, timeout=15, allow_redirects=True))
                except Exception:
                    continue
                if not sada or verzije.get(href) == sada:
                    continue
                if href not in verzije:
                    nove_verzije[href] = sada  # prvi put: samo zapamti, bez ponovnog čitanja
                    continue
                izmenjen = True
                print(f'  IZMENJEN (ista adresa, nov fajl): {href}')
            else:
                print(f'  NOVO: {href}')

            pdf_name = href.split('/')[-1]
            pdf_path = Path(f'/tmp/{pdf_name}')

            try:
                odgovor = requests.get(href, timeout=30)
                odgovor.raise_for_status()
                pdf_path.write_bytes(odgovor.content)
            except Exception as e:
                print(f'  GREŠKA pri preuzimanju: {e}')
                errors.append(href)
                continue

            result = subprocess.run(
                [sys.executable, str(MERGE_SCRIPT), str(pdf_path), '--rokovi', str(ROKOVI_FILE)],
                capture_output=True, text=True
            )

            if result.returncode != 0:
                # merge_rok deo grešaka piše na stdout ("nije prepoznat tip PDF-a").
                izlaz = (result.stdout + result.stderr).strip()
                print(f'  GREŠKA u merge_rok.py:\n{izlaz}')
                errors.append(href)
                greske.append({'pdf': pdf_name, 'url': href, 'razlog': '\n'.join(izlaz.splitlines()[-8:])})
                continue

            print(result.stderr.strip())

            # "Gotovo: N unosa u 'rok name'."
            rok_name = None
            count = 0
            for line in result.stdout.splitlines():
                if line.startswith('Gotovo:'):
                    try:
                        count = int(line.split(':')[1].strip().split()[0])
                        total_entries += count
                    except Exception:
                        pass
                    if "'" in line:
                        rok_name = line.split("'")[1]

            if count == 0:
                # Parser nije izvukao ni jedan unos - PDF se ne beleži kao poznat
                # da bi bio pokušan ponovo pri sledećem pokretanju.
                print(f'  UPOZORENJE: 0 unosa iz {pdf_name} - neće biti ubeležen kao poznat (retry sledeći put).')
                errors.append(href)
                greske.append({'pdf': pdf_name, 'url': href, 'razlog': 'parser nije izvukao nijedan termin'})
                continue

            # Termini su upisani, ali neki redovi tabele nisu mogli da se pročitaju
            # (npr. FON-ov PDF sa preklopljenim tekstom): issue, da se dopune ručno.
            neprocitani = [l.removeprefix('NEPROČITAN RED: ') for l in result.stdout.splitlines() if l.startswith('NEPROČITAN RED: ')]
            if neprocitani:
                print(f'  UPOZORENJE: {len(neprocitani)} redova nije pročitano.')
                greske.append({'pdf': pdf_name, 'url': href,
                               'razlog': f'{len(neprocitani)} redova tabele nije pročitano (ostali termini su upisani):\n' + '\n'.join(neprocitani[:20])})

            if verzija(odgovor):
                nove_verzije[href] = verzija(odgovor)
            new_pdfs += 1
            # Izmenjen fajl samo osveži termine (bez notifikacije "Raspored ...").
            if izmenjen:
                continue
            new_roks.append({'rok': rok_name or pdf_name, 'tip': tip})
            new_known.append(href)

    # --- Da otkaz ne bi prošao kao uredan prolaz -------------------------------
    # Bez ovoga oba kvara ispod završe kao zelen GitHub Actions run sa porukom
    # "Nema novih PDF-ova.", identičnom onoj koju daje i uredan prolaz. Nenulti
    # izlaz obara workflow, a GitHub na pao zakazani workflow šalje mejl - to je
    # ceo mehanizam uzbune.
    kvar = None
    if stranica_ok == 0:
        kvar = 'nijedna stranica sa FON-a nije dohvaćena'
    elif pdf_linkova == 0 and known:
        kvar = (f'nula PDF linkova na {stranica_ok} dohvaćenoj/ih stranici/a, '
                f'a ranije ih je bilo {len(known)} - verovatno je promenjen sajt')
    if kvar:
        print(f'\nGREŠKA: {kvar}.')
        print('Ništa nije upisano. Proveri da li su se stranice FON-a promenile:')
        for url in PAGES.values():
            print(f'  {url}')
        sys.exit(1)

    if new_known != known:
        KNOWN_FILE.write_text(json.dumps(new_known, indent=2, ensure_ascii=False), encoding='utf-8')
    if nove_verzije != verzije:
        VERZIJE_FILE.write_text(json.dumps(nove_verzije, indent=2, ensure_ascii=False, sort_keys=True), encoding='utf-8')

    if errors:
        print(f'\nGreške ({len(errors)}): {", ".join(errors)}')
    if greske:
        GRESKE_FILE.write_text(json.dumps(greske, indent=2, ensure_ascii=False), encoding='utf-8')

    # Čišćenje starih/praznih rokova radi se uvek (i kad nema novih PDF-ova).
    pruned = prune_rokovi()
    if pruned:
        print(f'Obrisano {len(pruned)} starih/praznih rokova: {", ".join(pruned)}')

    if new_pdfs == 0:
        if pruned:
            set_commit_msg(f'auto: očišćeno {len(pruned)} starih rokova')
        elif nove_verzije != verzije:
            set_commit_msg('auto: zapamćene verzije fajlova sa FON-a')
        print('Nema novih ni izmenjenih fajlova.')
        return

    # Zapiši nove rokove da ih send_push.mjs pošalje kao notifikacije (izmenjen
    # fajl pod istom adresom samo osveži termine, bez notifikacije).
    if new_roks:
        PENDING_NOTIFY_FILE.write_text(
            json.dumps(new_roks, indent=2, ensure_ascii=False), encoding='utf-8'
        )

    commit_msg = f'auto: rokovi sa FON-a ({new_pdfs} fajl{"" if new_pdfs == 1 else "a"}, {total_entries} unosa)'
    if pruned:
        commit_msg += f' (+ očišćeno {len(pruned)} starih)'
    set_commit_msg(commit_msg)


if __name__ == '__main__':
    main()
