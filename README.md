# Hemskarm

Statisk hemskarm med stora knappar till favoritappar, byggd for gamla iPads (ren HTML + CSS + ES5, inga ramverk/CDN).

- `apps.json` styr knapparna (name, icon, url, color, group; ordning = listordning). Hojer `rev` vid commit sa att enhetens lokala redigeringar ersatts.
- Redigeringsvy pa sidan (Redigera): lagg till/ta bort/flytta/andra. Sparas i localStorage pa enheten. "Visa JSON" ger text att skicka till Boss for permanent andring.
- Inloggning: klientgrind. E-post + losenord -> PBKDF2-HMAC-SHA256 (100 000 iter, ren ES5) jamfors med hash i `auth.json`. Samma losenord/e-post som Husvakten (Husvakten anvander WebCrypto + AES-GCM, som gamla Safari saknar). Inloggningen kommer ihag i localStorage (`hs_ok` = hash, aldrig losenord).
- **Bara en bekvamlighetsspärr, inte sakerhet.** Repot ar publikt: lagg ALDRIG hemligheter har, bara lankar till publika sidor.
- `tools/make-auth.js` skapar `auth.json` (laser ~/.husvakten, skriver inte ut nagot). `tools/make-auth.js --test e l` for test.
- Test: `PYTHONIOENCODING=utf-8 python test/test.py <epost> <losen>` (playwright, 1024x768, 768x1024, 412).
- Rollback: `git revert` / checka ut foregaende commit eller tagg och pusha.
- Hosting: GitHub Pages (gratis, publikt repo).
