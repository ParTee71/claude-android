---
name: accessibility-compose
description: Tillgänglighet (a11y) i Compose-UI — appen ska fungera med TalkBack, stor text, färgblindhet och tillräckliga tryckytor. Ladda denna när du bygger eller ändrar UI: ikoner, knappar, klickbara ytor, bilder, kryssrader, kort, fält, steppers, sliders, progress, rader med belopp, diagram. Trigger-ord: tillgänglighet, accessibility, a11y, TalkBack, skärmläsare, contentDescription, semantics, mergeDescendants, stateDescription, touch target, tryckyta, dynamisk text, stor text, fontScale, kontrast, färgblind, belopp, procent, diagram.
---

# Tillgänglighet i Compose

Appen ska kunna användas av alla – även med skärmläsare, förstorad text, utan att se färg och
med nedsatt motorik. Tillgänglighet är ett kvalitetskrav, inte en extrafunktion. Repots egna
krav-ID:n för tillgänglighet står i repots kravlista (se repots CLAUDE.md).

Eftersom varje elementtyp har **en** delad komponent (repots skill för delade komponenter)
löses tillgänglighet **i komponenten**, en gång, och gäller då överallt. Fixa aldrig semantik
per anropare – utöka den delade komponenten.

## Regler

### 1. contentDescription — meningsbärande vs dekorativt
- **Meningsbärande** ikon/bild (ikonknapp, statusikon, avatar, väntesnurra) ska ha en
  beskrivande, **svensk** `contentDescription` från `strings.xml` som säger *vad* – t.ex.
  "Uppdaterar <kortets namn>" när flera kort kan vänta samtidigt.
- **Rent dekorativ** grafik (sektionsikon bredvid rubriktext, legendprick, avdelare,
  konfetti) ska ha `contentDescription = null` så att TalkBack hoppar över den.
- Upprepa inte synlig text i `contentDescription` på samma nod (dubbelläsning).

### 2. Tryckytor minst 48dp
Alla klickbara element ska ha minst **48×48dp** tryckyta. Små ikoner använder repots delade
ikonknapp eller, inne i `ui/components`, `Modifier.minimumInteractiveComponentSize()` – aldrig
en naken 24dp-ikon med `clickable`. Eget val (chips, periodknappar, knappgrupper) följer M3:s
knappstorlek och läses som radioval (`Role.RadioButton` + vald).

### 3. Stöd dynamisk textstorlek
Text och `lineHeight` i **`sp`** via repots typografi. Lås inte höjder så att förstorad text
klipps. Komponentgalleriet har en skärmdump med `fontScale = 1.3` som fångar klippning.
En rad med etikett och värde kapar etiketten (`weight` + ellips), aldrig värdet. Skärmar som
kan växa skrollar.

### 4. Gruppera och semantik
- En rad eller ett kort som är **en** logisk enhet använder
  `Modifier.semantics(mergeDescendants = true)` så TalkBack läser namn, värde och status i ett
  svep.
- Kryssrad: `Role.Checkbox` + `stateDescription` (t.ex. "tagen"/"inte tagen"); annonsera namn
  och mängd i samma nod.
- Stepper: knapparna har "Minska"/"Öka" + aktuellt värde och enhet.
- Progress: `contentDescription` i ord, t.ex. "9 av 14 klara".
- Slider/gradering: värde och etikett.
- Expanderbara sektioner och växlar kommunicerar läget (`stateDescription` eller `Role`).
  Listrader och ihopfällbara kort: hela raden är tryckytan, chevronen är en ren indikator.
- Ångra i snackbar ska vara nåbar och annonseras.

### 5. Belopp, procent och tal läses upp begripligt
- Formatera alltid via repots delade formatterare. Äkta minustecken (U+2212) och mellanslag
  före enheten gör att TalkBack läser "minus fem komma noll procent", inte "bindestreck".
- Tabulära siffror behåller kolumnerna vid stor text, men raden får inte bli bredare än skärmen.
- Skriv aldrig ut bara en förkortning eller en kod som enda bärare – namnet finns i texten eller
  i `contentDescription`.

### 6. Färg är aldrig ensam bärare av information
Status, kategori-, person- eller vinst/förlustfärg kompletteras alltid med text, tecken (+/−),
pil eller ikon. Kontrast minst **4.5:1** för brödtext i både ljust och mörkt tema.

### 7. Diagram har en textsammanfattning
En diagramcanvas är osynlig för skärmläsare. Varje diagram sätter en `contentDescription` med
period, antal punkter, lägsta och högsta värde och seriernas namn (texten i `strings.xml`).
Serierna namnges i teckenförklaringen, inte bara i linjefärgen.

## Tester

Compose-UI-test (Robolectric i JVM eller instrumenttest) kan assertera semantik utan TalkBack:
```kotlin
composeTestRule.onNodeWithContentDescription("Tillbaka").assertHasClickAction()
composeTestRule.onNode(hasStateDescription("inte tagen")).assertIsDisplayed()
composeTestRule.onNodeWithText("−5,0 %").assertIsDisplayed()
```
Lägg sådana assertions i den delade komponentens test när du ändrar en interaktiv komponent.
Nya delade komponenter verifieras för `contentDescription`, `Role` och tryckyta.

## Checklista

- [ ] Meningsbärande ikoner/bilder har svensk `contentDescription`; dekorativa har `null`.
- [ ] Klickbara element ≥ 48dp tryckyta.
- [ ] Text i `sp`; galleriets `fontScale = 1.3`-skärmdump utan klippning; värdet kapas aldrig.
- [ ] Logiska grupper merge:ade; tillstånd har `stateDescription`/`Role`.
- [ ] Tal och belopp via den delade formatteraren, med äkta minustecken.
- [ ] Ingen information enbart via färg; kontrast ≥ 4.5:1 i ljust och mörkt tema.
- [ ] Diagram har textsammanfattning och namngivna serier.
- [ ] Semantiken ligger i den delade komponenten, inte hos anroparen.
