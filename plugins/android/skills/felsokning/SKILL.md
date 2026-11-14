---
name: felsokning
description: "Metod för svåra fel i alla Mats repon: ett kommando som blir rött först, krympa, hypoteser med förutsägelser, mät en sak i taget, regressionstest före rättningen. Ladda när orsaken inte syns direkt, ett test faller ibland, en rättning misslyckats eller felet bara syns i drift. Trigger-ord: felsök, buggjakt, hittar inte felet, instabilt test, flaky, långsamt, regression."
---

# Felsökning (alla Mats repon)

En metod för de fel som kostar mest: orsaken syns inte efter en första läsning, ett test faller
ibland, en rättning har redan misslyckats en gång, eller felet syns bara i drift.

**Behövs inte** när orsaken är uppenbar. Då gäller `arbetsflode` → Bygg direkt: ett test som
faller först, sedan minsta rättningen.

Läs inte kod för att bygga en teori innan steg 1 är klart. Att hoppa till en hypotes är just
det felet metoden förhindrar.

## 1. Ett kommando som blir rött på just det här felet

Innan någon teori. Pröva i ungefär den här ordningen:

1. Ett test på den nivå som når felet (enhet, ViewModel, Robolectric, e2e).
2. Ett skript (curl, `node`) mot en lokalt körd app.
3. En fixtur genom kodvägen, med utdata jämförd mot ett känt bra svar.
4. En inspelad begäran eller händelselogg som spelas upp genom koden.
5. En slinga med slumpade indata, när felet är "ibland fel svar".
6. `git bisect run` med kommandot, när felet kom in mellan två kända lägen.

Exempel per stack, inte facit: `./gradlew :core:test --tests '*PackingEngineTest*'`,
`./gradlew :app:testDebugUnitTest --tests '<klass>'` (Robolectric i JVM), rules- och
rundturstest mot Firebase-emulatorn, `npm test -- <fil>`, Playwright mot ett lokalt bygge,
`npm run lokalt` i Husjakt.

**Klart när** kommandot är kört minst en gång och
- visar **användarens** symptom, inte bara "kraschar inte",
- ger samma utfall varje gång (instabila fel: se nedan),
- går på sekunder och utan en människa.

Gör det sedan snabbare och skarpare: smalare testurval, fäst tid och slump, stubba nätet.

**Går ingen slinga att bygga:** stanna. Säg vad som prövats och be Mats om det som saknas –
åtkomst, en logg eller en skärminspelning med tider. Gissa inte vidare.

## 2. Återskapa och krymp

Kör kommandot och se det bli rött. Bekräfta att det är **det** felet och inte ett grannfel.
Ta sedan bort en sak i taget – indata, anrop, inställning, steg – och kör efter varje. Klart
när allt som är kvar behövs för att det ska bli rött.

## 3. Tre till fem hypoteser

Rangordnade, var och en med en förutsägelse: "om X är orsaken försvinner felet när Y ändras".
Går förutsägelsen inte att formulera är det ingen hypotes. Visa listan för Mats – han vet ofta
vad som nyss ändrats – men vänta inte på svar.

## 4. Mät en sak i taget

Varje mätpunkt hör till en förutsägelse. Debugger före loggrader; aldrig "logga allt och sök".
Tillfälliga loggrader får ett eget prefix, t.ex. `[FELSOK-a4f2]`, så att de går att ta bort med
en sökning. **Prestandafel:** mät en baslinje först, rätta sedan.

## 5. Regressionstest före rättningen

Gör det krympta fallet till ett test som faller, på en nivå där testet verkligen når felets
mönster. Se det falla, rätta, se det gå igenom, och kör kommandot från steg 1 mot det
ursprungliga fallet. **Finns ingen sådan nivå** är det ett fynd: skriv det i PR:en i stället
för ett test som ger falsk trygghet.

## 6. Städa och bevisa

- [ ] Kommandot från steg 1 är grönt.
- [ ] Regressionstestet går igenom, eller avsaknaden av nivå står i PR:en.
- [ ] Inga `[FELSOK-`-rader kvar (sök på prefixet), tillfälliga skript borta.
- [ ] PR:en säger vilken hypotes som stämde.

## Reglerna här

- **Slingan körs lokalt, aldrig i CI.** Ingen push för att se om felet finns kvar (`arbetsflode`
  → en push; Husjakts minutregel).
- **Instabila fel:** målet är en högre felfrekvens, inte ett rent återskapande. Kör utlösaren
  många gånger, parallellt, pressa tidsfönstret – tills felet går att jaga. Det är metoden, inte
  en omkörning för att få grönt. Beslutet om ett issue står i `arbetsregler` → Instabila tester.
- **Aldrig mot skarp data.** Slingan skriver inte mot driften; läsning sker enligt repots regler.
- **Integritet:** hälsodata och personuppgifter loggas inte, inte heller tillfälligt. Hemligheter
  skrivs aldrig ut; visa `<REDACTED>` och låt nycklar ligga i miljön.

---

Efter Matt Pococks `diagnosing-bugs` i
[mattpocock/skills](https://github.com/mattpocock/skills/tree/main/skills/engineering/diagnosing-bugs)
(MIT, Copyright (c) 2026 Matt Pocock), anpassad till Mats repon och regler.
