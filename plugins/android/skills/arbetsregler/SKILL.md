---
name: arbetsregler
description: Mats gemensamma arbetsregler för alla projekt (Android-repona, android-ui, Husjakt, VeckansMat) – när en plan i ett issue och hans ok krävs före kod, när en tråd mergar själv, ärliga svar och modell efter jobbet. Ladda innan arbete påbörjas eller planeras, innan en PR skapas eller mergas, och när det är oklart om något kräver ett ok. Trigger-ord: plan, issue, godkänd, plan-godkänd, kör, ok, liten ändring, merga, PR, får jag, vänta på ok, ärliga svar, modell, agent.
---

# Gemensamma arbetsregler (alla Mats projekt)

Enda källan för reglerna nedan. Repons CLAUDE.md har dem i korthet och länkar hit. Repons egna
säkerhetsregler gäller ovanpå (Husjakts invarianter och skarpa data, VeckansMats publika repo,
Actions-minuterna i de privata repona) – de lättas inte av något här.

## Plan före kod – bara för större saker (Mats 2026-11-10)

| Ändring | Före kod | PR och merge |
|---|---|---|
| **Större:** nytt eller ändrat beteende, ny skärm eller vy, flera lager, datamodell, migrering, ny källa eller nytt beroende, eller ett verkligt vägval | Plan i ett GitHub-issue (`refine-issue`) och Mats ok: "kör" i tråden eller etiketten `plan-godkänd` | Tråden driver till merge utan fler frågor när CI är grönt |
| **Liten:** buggfix med uppenbar rättning, dokument, kommentarer, text, beroendebump utan API-ändring, test, ren städning i en fil | Inget issue krävs | PR-texten har raden `Liten ändring: <varför>`; tråden mergar själv när CI är grönt |

- **Osäker? Då är den större.** Att kalla något litet för att slippa vänta är just felet som
  VeckansMat beslut 0018 skrevs efter (en PR mergades utan att ägaren sett planen).
- Raden `Liten ändring:` gör bedömningen synlig i PR:en, så att Mats kan se och säga emot i
  efterhand. VeckansMats plan-kontroll godtar den.
- Mockup före ny GUI gäller oavsett storlek (`mockup`).
- Ett "kör" eller `plan-godkänd` gäller planen i issuet. Växer arbetet utanför planen: stanna och
  säg det, eller skriv ett tillägg i issuet och få ett nytt ok.
- Mats beslut, även de han tar i en tråd, skrivs in i issuet eller i repots regler – inte bara i
  chatten.

## Ärliga svar (Mats 2026-11-10)

Säg emot när Mats har fel, och säg varför. Inget beröm för frågan, inga artighetsfraser, inga
ursäkter, ingen utfyllnad. Säg vad som är osäkert eller inte kontrollerat. Ett nej mjukas inte upp.

## Modell efter jobbet (Mats 2026-11-10)

Varje tråd, session och agent kör den modell jobbet kräver – lagom kraftig, aldrig kraftigare.
Tabellen står i skill `ai-model-choice`. Agenter har en egen `model` i frontmattern, aldrig
`inherit`: annars granskar en granskare på Fable bara för att tråden råkar gå på Fable.
Granskare kör Opus 5.5.
