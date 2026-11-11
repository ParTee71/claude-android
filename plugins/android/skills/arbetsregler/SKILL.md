---
name: arbetsregler
description: Mats gemensamma arbetsregler för alla projekt (Android-repona, android-ui, Husjakt, VeckansMat) – när en plan i ett issue och hans ok krävs före kod, när en tråd mergar själv, instabila tester, ärliga svar, modell efter jobbet, tider i svensk tid, tokentak och agenter. Ladda innan arbete påbörjas eller planeras, innan en PR skapas eller mergas, och när det är oklart om något kräver ett ok. Trigger-ord: fråga, bekräfta, driva igenom, en PR i taget, svenska, tid, klockslag, UTC, tokentak, pausa, agenter, parallellt, plan, issue, godkänd, plan-godkänd, kör, ok, liten ändring, merga, PR, får jag, vänta på ok, ärliga svar, modell, agent, instabilt test, flaky, omkörning, rött CI.
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
- **Varje issue skrivs med repots förfina-skill** (`android:refine-issue`, VeckansMats
  `refine-issue`, Husjakts `forfina`; tabellen i `arbetsflode`) – även när en granskning, en
  annan tråd eller koordinatorn skapar det. Ett issue skrivet direkt med `issue_write` är ett
  utkast: det förfinas innan det genomförs. Inget issue behövs för en liten ändring, men skrivs
  ett, gäller samma sak.

## Driva arbetet (Mats 2026-10-18 och 2026-11-10)

- **Driv igenom utan bekräftelsefrågor.** När Mats sagt "kör" eller planen är godkänd genomförs
  allt till merge. Fråga bara det som är viktigt: ett val som ändrar målet, något som inte går att
  ångra (skarp data, release, radering, något som skickas utanför projektet) eller en motsägelse i
  det han bett om. Ett val som går att ändra i efterhand görs och redovisas.
- **En PR i taget per repo.** Nästa öppnas först när den förra är mergad, kontrollerat via GitHub
  (`pull_request_read`), inte antaget. Gäller också trådar som arbetar parallellt i samma repo.
- **Svar till Mats på svenska**, korta. Kod och identifierare följer repots språkregel.
- **Mats beslut skrivs ner där nästa tråd hittar dem**: i issuet eller repots regler, och det som
  gäller alla repon här. En tråd som bara minns ett beslut i chatten tappar det.

## Instabila tester (Mats 2026-11-10)

Ett test som ibland faller utan att koden ändrats kostar en körning varje gång. Chansa inte.

- Kör inte om för att få grönt, och skriv inte av felet som en slump.
- Samla belägget: körningens länk, felet, och artefakter som trace och skärmdump.
- **Fråga Mats om ett issue ska skrivas för att göra testet stabilt.** Säger han ja: skriv
  issuet med belägget, en trolig orsak (märkt som obevisad) och vad som ska rättas. Gör testet
  deterministiskt, eller rätta appen om felet ligger där. Ett test får aldrig tas bort, hoppas
  över eller försvagas.
- Föll testet i en PR som inte rör koden det testar: säg det i PR:en, med en länk till issuet.
  Mats avgör om PR:en får vänta på rättningen.

## Ärliga svar (Mats 2026-11-10)

Säg emot när Mats har fel, och säg varför. Inget beröm för frågan, inga artighetsfraser, inga
ursäkter, ingen utfyllnad. Säg vad som är osäkert eller inte kontrollerat. Ett nej mjukas inte upp.

## Modell efter jobbet (Mats 2026-11-10)

Varje tråd, session och agent kör den modell jobbet kräver – lagom kraftig, aldrig kraftigare.
Tabellen står i skill `ai-model-choice`. Agenter har en egen `model` i frontmattern, aldrig
`inherit`: annars granskar en granskare på Fable bara för att tråden råkar gå på Fable.
Granskare kör Opus 5.5.

## Tider i svensk tid (Mats 2026-11-10)

Tider till Mats skrivs i svensk tid (`Europe/Stockholm`): CEST är UTC+2, CET UTC+1. GitHub,
Actions, cron och loggar räknar i UTC – citera en UTC-tid bara med den svenska bredvid. Kod,
cron-uttryck och tidsstämplar i filer ändras inte.

## Tokentak och agenter (Mats 2026-11-10)

- **Går sessionen i taket för tokens:** committa och pusha det som är klart, säg läget i en
  mening och fortsätt där det slutade när nya tokens finns – utan att fråga om det som redan är
  avgjort. Inget lämnas halvgjort eller avrundas i förtid. Kan sessionen schemalägga sin
  återkomst gör den det.
- **Agenter parallellt är tillåtet, inte förval.** Använd dem för oberoende delar (egna filer
  eller en egen worktree) när det sparar verklig tid; en tråd som klarar jobbet själv gör det
  själv, eftersom varje agent kostar tokens. Granska agentens resultat och kör kontrollerna
  själv före push – rapporten är ett påstående.
