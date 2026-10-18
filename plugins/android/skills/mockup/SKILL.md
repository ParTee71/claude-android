---
name: mockup
description: Processregeln "mockup före ny GUI" — ny skärm, ny komponent eller tydligt ändrat utseende/beteende visas som en mockup (Design-canvas) för användaren och godkänns innan någon kod skrivs, för att slippa byggen och releaser bara för att se hur det blev. Ladda denna ALLTID innan du bygger eller ändrar något som syns. Trigger-ord: ny skärm, ny vy, ny flik, ny komponent, visa, mockup, skiss, design, prototyp, canvas, hur ska det se ut, layout, ändra utseendet, gör om skärmen, ny knapp, nytt kort, diagram, flöde, GUI, UI.
---

# Mockup före ny GUI

Utvecklingen sker mest från telefonen, och ett bygge eller en release för att "se hur det
blev" är dyrt. Därför visas nytt utseende och beteende först som en mockup, och koden skrivs
först efter användarens ok. Repots krav-ID för regeln står i repots kravlista (se repots CLAUDE.md).

## När

| Ändring | Mockup? |
|---|---|
| Ny skärm | Ja |
| Ny delad komponent eller ram | Ja |
| Tydligt ändrat utseende eller beteende (syns i en tumnagel) | Ja |
| Padding, ordval, ikonbyte, färgjustering inom temat | Nej – skärmdumpsdiffen i PR:en räcker |
| Ren logik utan synlig ändring | Nej |

## Mallen

Varje mockup startar från repots **mall**: en Design-canvas med
1. **komponentarket** – alla komponenter i katalogen (repots skill för delade komponenter) i ljust och mörkt,
2. **beteendearket** – ramarnas tillstånd (lista: laddar/tom/fel/innehåll; redigering:
   ogiltig/giltig/sparfel/"Släng ändringar?"; arkivera med ångra; radering med bekräftelse).

**Mallens länk** och repots designreferenser står i repots CLAUDE.md (processregeln). Finns
ingen mall än blir den första mockupen mallen, och länken skrivs in i repots CLAUDE.md i samma
PR. Mallen är en approximation – det byggda är facit: jämför med komponentgalleriet och
skärmdumparna i repot.

När katalogen ändras uppdateras mallen i samma PR som komponenten.

## Så bygger du en mockup

1. Skapa en Design-canvas (Artifact-typen "Design") – en per issue, eller nya artboards i
   issuets befintliga canvas.
2. Telefonyta 390 × 844 eller högre; ljust tema först, mörkt när det spelar roll (färger som
   byter ton mellan temana, diagram).
3. Bygg skärmen av **element ur mallen** – samma utseende som katalogen, i appens designspråk
   (repots skill för designspråket). Använd ramarnas struktur (listskärm, redigeringsskärm) när
   skärmen är en lista eller ett formulär.
4. Riktiga svenska texter och realistisk men **påhittad** data i appens domän, i svenskt format
   ("12 345,67 kr", "+4,2 %", "−1,8 %"). Inga platshållartexter, och **aldrig användarens
   riktiga data** – inte heller avrundad eller "lite ändrad". Hälso- och ekonomidata särskilt.
5. **Finns elementet redan i appen** (katalogen, en byggd skärm eller en tidigare version) →
   återanvänd det på samma sätt som tidigare: samma komponent, samma utseende, samma beteende.
   Det är ingen designfråga och ställs inte som en (samma look and feel överallt). Bara för det
   som är **helt nytt** och har en verklig öppen fråga → två artboards sida vid sida och en kort
   beskrivning av skillnaden.
6. Allt som saknas i katalogen märks tydligt **"NY KOMPONENT"** eller **"NYTT MÖNSTER"** – det
   byggs då som delad del, aldrig lokalt i featuren.
7. Visa de tillstånd som betyder något: tomt, laddar, fyllt, fel, avprickat, okänd data och lång
   text som kapas.

## Visa och vänta

- Ge länken och en eller två meningar om vad som visas och vilka val som är öppna.
- **Skriv ingen kod innan användaren godkänt** eller bett om ändringar. Ändringar görs i
  samma canvas.
- Länken läggs i issuet under rubriken **Design**.

## I PR:en

- Roborazzi-skärmdumpar (ljust + mörkt) av det byggda, bredvid mockup-länken. Kan repot inte
  spela in dem än: beskriv resultatet och länka ett testbygge.
- Avvikelser från mockupen förklaras i PR-beskrivningen.

## Mockup är inte kod

Mockupens HTML/CSS kopieras aldrig till appen. Översätt till tema-tokens (`ui/theme`) och
delade komponenter. Färgvärden i mockupen är en approximation av temat, inte källan.
