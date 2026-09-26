"""Testovi za update_nastava --check-new: da li FON nudi semestar noviji od
objavljenog u 1god.json.

Sintetički HTML umesto snimka stranice. Struktura prati pravu stranicu
(naslov „Школска година …“, pa liste linkova po semestru); u septembru 2026.
stranica je već imala naslov 2026/27, a umesto PDF-ova samo `#` linkove.
"""
import update_nastava as un

ROMAN = ["I", "II", "III", "IV"]


def page(year_heading, links=""):
    return f"""
    <div class="entry-content">
      <h2 class="elementor-heading-title">Школска година {year_heading}</h2>
      <h2 class="elementor-heading-title">Распоред наставе <br/>зимски семестар</h2>
      <ul>{links}</ul>
    </div>
    """


def pdf_links(semester, uploads="2026/09", years=(1, 2, 3, 4)):
    out = []
    for y in years:
        r = ROMAN[y - 1]
        base = f"https://oas.fon.bg.ac.rs/wp-content/uploads/{uploads}"
        out.append(
            f'<li><a href="{base}/Raspored-{semester}-{r}-godina.pdf">'
            f"Распоред наставе за {r} годину (ажурирано 20.9.)</a></li>"
            f'<li><a href="{base}/Grupe-{semester}-{r}-godina.pdf">'
            f"Групе за слушање наставе за {r} годину</a></li>"
        )
    return "".join(out)


PLACEHOLDERS = "".join(
    f'<li><a href="#">Распоред наставе за {r} годину</a></li>' for r in ROMAN
)
YEARS = [1, 2, 3, 4]


def test_next_semester():
    assert un.next_semester("Letnji 2025/26") == ("zimski", "2026/27")
    assert un.next_semester("Zimski 2026/27") == ("letnji", "2026/27")
    assert un.next_semester("Letnji 2099/00") == ("zimski", "2100/01")
    assert un.next_semester("") is None


def test_stara_godina_nije_novo():
    # Naslov i dalje kaže prošlu godinu, a zimski PDF-ovi su prošlogodišnji.
    html = page("2025/26", pdf_links("zimski", uploads="2025/09"))
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None


def test_nova_godina_bez_pdfova_nije_novo():
    # Stanje sa prave stranice krajem septembra 2026.
    html = page("2026/27", PLACEHOLDERS)
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None


def test_nova_godina_sa_pdfovima_je_zimski():
    html = page("2026/27", pdf_links("zimski"))
    assert un.check_new(html, "Letnji 2025/26", YEARS) == "zimski"


def test_nova_godina_ali_stari_pdfovi_nije_novo():
    # Naslov je promenjen, ali linkovi vode na prošlogodišnje uploade.
    html = page("2026/27", pdf_links("zimski", uploads="2025/09"))
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None


def test_deo_godina_nije_novo():
    html = page("2026/27", pdf_links("zimski", years=(1, 2)))
    assert un.check_new(html, "Letnji 2025/26", YEARS) is None
    assert un.check_new(html, "Letnji 2025/26", [1, 2]) == "zimski"


def test_zimski_objavljen_ne_trazi_ponovo():
    html = page("2026/27", pdf_links("zimski"))
    assert un.check_new(html, "Zimski 2026/27", YEARS) is None


def test_letnji_iste_skolske_godine():
    html = page("2026/27", pdf_links("letnji", uploads="2027/02"))
    assert un.check_new(html, "Zimski 2026/27", YEARS) == "letnji"


def test_letnji_prosle_godine_nije_novo():
    # Prošlogodišnji letnji koji je ostao na stranici.
    html = page("2026/27", pdf_links("letnji", uploads="2026/02"))
    assert un.check_new(html, "Zimski 2026/27", YEARS) is None


def docx_links(semester, uploads="2026/09", years=(1, 2, 3, 4)):
    return pdf_links(semester, uploads, years).replace(".pdf", ".docx")


def test_word_kad_nema_pdf():
    # Zimski 2026/27: FON je okačio samo Word.
    html = page("2026/27", docx_links("zimski"))
    assert un.check_new(html, "Letnji 2025/26", YEARS) == "zimski"
    files = un.resolve_files(html, "zimski")
    assert files[1]["raspored"].endswith(".docx")
    assert files[1]["grupe"].endswith(".docx")


def test_pdf_ima_prednost_nad_word():
    html = page("2026/27", docx_links("zimski") + pdf_links("zimski"))
    files = un.resolve_files(html, "zimski")
    assert all(f["raspored"].endswith(".pdf") and f["grupe"].endswith(".pdf") for f in files.values())


def _known(html, semester="Zimski 2026/27"):
    return {"semester": semester, "files": un.files_snapshot(un.resolve_files(html, "zimski"))}


def test_ista_verzija_nije_novo():
    html = page("2026/27", docx_links("zimski"))
    assert un.check(html, "Zimski 2026/27", YEARS, _known(html)) is None


def test_nova_verzija_istog_semestra():
    # Dopuna: FON okači nov fajl (npr. sa izbornim predmetima) za 4. godinu.
    old = page("2026/27", docx_links("zimski"))
    new = old.replace("Raspored-zimski-IV-godina.docx", "Raspored-zimski-IV-godina-dopuna.docx")
    assert un.check(new, "Zimski 2026/27", YEARS, _known(old)) == "zimski"


def test_pdf_posle_word_je_nova_verzija():
    old = page("2026/27", docx_links("zimski"))
    new = page("2026/27", docx_links("zimski") + pdf_links("zimski"))
    assert un.check(new, "Zimski 2026/27", YEARS, _known(old)) == "zimski"


def test_bez_zapisa_o_objavljenom_nije_novo():
    # Bez known_nastava.json (ili za drugi semestar) ne pogađamo.
    html = page("2026/27", docx_links("zimski"))
    assert un.check(html, "Zimski 2026/27", YEARS, {}) is None
    assert un.check(html, "Zimski 2026/27", YEARS, _known(html, "Letnji 2025/26")) is None


def _known_with_sha(html, sha="stari"):
    files = un.resolve_files(html, "zimski")
    hashes = {f[k]: sha for f in files.values() for k in ("raspored", "grupe")}
    return {"semester": "Zimski 2026/27", "files": un.files_snapshot(files, hashes)}


def test_isti_link_isti_sadrzaj_nije_novo():
    html = page("2026/27", docx_links("zimski"))
    assert un.check(html, "Zimski 2026/27", YEARS, _known_with_sha(html), lambda url: "stari") is None


def test_isti_link_nov_sadrzaj_je_nova_verzija():
    # FON pregazi fajl na istoj adresi: link isti, sadržaj drugi.
    html = page("2026/27", docx_links("zimski"))
    digest = lambda url: "nov" if "IV-godina" in url and "Raspored" in url else "stari"
    assert un.check(html, "Zimski 2026/27", YEARS, _known_with_sha(html), digest) == "zimski"


def test_bez_sacuvanog_otiska_ne_poredi_sadrzaj():
    html = page("2026/27", docx_links("zimski"))
    assert un.check(html, "Zimski 2026/27", YEARS, _known(html), lambda url: "bilo-sta") is None

