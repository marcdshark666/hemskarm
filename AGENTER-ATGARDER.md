# Åtgärder: när Marc måste göra något (för Boss och alla agenter)

Behöver du att Marc gör, fyller i, godkänner eller bestämmer något i en app? Skriv inte bara i chatten. Lägg en åtgärd, så blinkar appen rött på iPad-hemskärmen (/hemskarm/) med en siffra, och (i) förklarar vad som ska göras.

## Lägg till
```
node "E:\CHAT-RTX\CLAUDECODE GENERAL BRAIN\APP ideas\hemskarm\tools\begar.mjs" add --app <id i apps.json> --titel "Kort rubrik" --forklaring "Steg för steg. Rader som börjar med '$ ' blir kommandon med Kopiera-knapp, https-länkar blir klickbara." --prio hog|normal|lag --kategori logga-in|fyll-i|godkann|kor-kommando|granska|beslut --kalla Boss|agent|rutin [--id stabilt-id]
```
- `--app` måste vara ett id i `apps.json` (finns inte appen: använd närmaste, t.ex. `hemskarm`).
- Använd `--id` för stabilt id; samma id igen uppdaterar posten och flyttar den överst (inga dubbletter).
- Ingen serveromstart behövs. Hemskärmen hämtar listan var 60:e sekund.
- **Aldrig lösenord, nycklar, tokens eller personuppgifter** i titel/förklaring (uppenbara hemligheter avvisas).

## När det är klart eller ändrat
```
node ...\tools\begar.mjs list [--alla] [--app <id>]
node ...\tools\begar.mjs update <id> --forklaring "ny text"   (flyttar överst)
node ...\tools\begar.mjs done <id>      (Marc gjorde det; blinkningen försvinner)
node ...\tools\begar.mjs avvisa <id>    (inte aktuellt längre)
```
Marc kan också trycka "Markera klar" själv. Kolla `list` innan du lägger en ny så att du inte skapar dubbletter, och kör `done` så fort du ser att det är gjort.

## Regler
1. Skapa en åtgärd varje gång något väntar på Marc (inloggning, nyckel, ja/nej, granskning, kommando han måste köra själv). Mejla/skriv gärna också, men åtgärden är den som syns på iPaden.
2. En åtgärd = en sak. Kort titel, konkreta steg i förklaringen.
3. `prio hog` bara när något blockerar annat arbete.
4. Datafil: `data/atgarder.json` (privat, gitignorerad). Klara åtgärder rensas efter 30 dagar.
