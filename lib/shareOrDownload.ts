// Deljena logika za "izvezi kao fajl" dugmad (Slika, ICS).
//
// Zašto: <a download> na data:/blob: URL tiho ne radi u instaliranoj iOS PWA
// (standalone mode) - nema browser chrome-a koji bi pokrenuo "sačuvaj u
// Files/Photos", pa klik izgleda uspešno (toast se prikaže) ali fajl nigde
// ne završi. Web Share API sa files radi u standalone PWA (otvara iOS share
// sheet, odakle "Save Image"/"Save to Files" stvarno radi), pa je prioritet.
// Desktop/Android bez podrške za file-share padaju na klasičan <a download>.

import { isIOS } from './push'

export function canvasToFile(canvas: HTMLCanvasElement, filename: string, type = 'image/png'): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (!blob) { reject(new Error('canvas.toBlob nije uspeo')); return }
      resolve(new File([blob], filename, { type }))
    }, type)
  })
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

// Šta se desilo sa fajlom: telefon je otvorio share (pa poruka ne treba),
// fajl je preuzet (poruka kaže gde je), ili je korisnik odustao.
export type IshodIzvoza = 'podeljeno' | 'preuzeto' | 'otkazano'

// Deli fajl preko Web Share API-ja ako je podržano (uključujući standalone
// PWA), inače klasičan download link. Ako korisnik otkaže share sheet
// (AbortError), tiho ne radi ništa dalje - nije greška.
export async function shareOrDownloadFile(file: File, shareTitle?: string): Promise<IshodIzvoza> {
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean
    share?: (data: { files: File[]; title?: string }) => Promise<void>
  }

  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share!({ files: [file], title: shareTitle })
      return 'podeljeno'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'otkazano'
      // Share nije uspeo iz nekog drugog razloga - probaj klasičan download.
    }
  }

  downloadBlob(file, file.name)
  return 'preuzeto'
}

// .ics za kalendar telefona. Na iPhone-u se Kalendar odmah otvori sa
// terminima; drugde se fajl preuzme, pa ga korisnik otvori.
export function preuzmiKalendar(ics: string, ime: string): IshodIzvoza {
  downloadBlob(new Blob([ics], { type: 'text/calendar;charset=utf-8' }), ime)
  return isIOS() ? 'podeljeno' : 'preuzeto'
}
