---
name: testing-strategy
description: Generell testregel för Android-repona (regel 2) — ingen beteendeändring utan tester på rätt nivå(er), befintliga tester uppdateras och tas aldrig bort, och flaky tester är buggar. Ladda tillsammans med repots egen testing-strategy (nivåer, hjälpare, kommandon) när du lägger till, ändrar eller fixar funktionalitet, en ViewModel, ett repository, en composable, en codec eller migrering, en hook eller en bugg. Trigger-ord: test, tester, testa, JUnit, MockK, Turbine, Robolectric, Roborazzi, skärmdump, screenshot, Konsist, cpdCheck, kontraktstest, fake, emulator, regression, flaky, instabil, täckning, TDD.
---

# Teststrategi (generellt)

**Repots skill `testing-strategy` går före det här.** Där står repots nivåtabell, de delade
testhjälparna, skärmdumpsdetaljerna (mått, filnamn, tolerans), kommandona under "Innan du anser
dig klar" och avsnittet **För testskrivaren** som agenten `android:testskrivare` läser.

## Regeln

En ändring av beteende är inte klar förrän tester lagts till eller uppdaterats på **varje
berörd nivå**. Befintliga tester **uppdateras** så att de speglar det nya beteendet – de tas
aldrig bort, `@Ignore`:as eller försvagas för att bli gröna.

**Ett test som ibland faller är en bugg.** Hitta grundorsaken – klocka, ordning, delat
tillstånd, animation, nätverk, otestad asynkronitet, en dispatcher som inte är testets – och gör
testet deterministiskt. Kör aldrig bara om.

**Selektiv körning i CI ändrar inte kravet** (skill `android:ci-budget`): ett test som inte körs
i en viss PR ska ändå finnas och vara grönt när dess kod ändras.

## Nivåerna

| Nivå | Typiskt verktyg | Var |
|---|---|---|
| Domän, beräkningar, codecs | JUnit + kotlin.test, synkront | JVM-modul (`:core`) eller `domain/` |
| ViewModel och repository | JUnit, Turbine, fakes, `MainDispatcherRule` | `app/src/test` |
| Compose-UI | Robolectric + `ui-test-junit4` | `app/src/test` |
| Skärmdump | Roborazzi, ljust + mörkt | `app/src/test` + referensbilder |
| Arkitektur och konsistens | Konsist (`UiConsistencyTest`), `cpdCheck` | `app/src/test`, hela källträdet |
| Data som ska överleva | rundturs-, migrerings- och rules-tester | repots datakedja (skill `data-safety-backup` i repot) |
| Instrument | Android-emulator | `app/src/androidTest` |
| Dokumentkontroller och hooktest | `node --test` | `.github/scripts/`, `.claude/hooks/test/` |

## Vad ska testas när du ändrar X

| Ändring | Lägg till / uppdatera |
|---|---|
| Domänlogik, formatterare, validering | test på domännivån med kantfallen, även datum kring midnatt och månadsskiften |
| Modell, codec, entitet, schema | rundtur, tolerans för saknade och okända fält, migrering (repots datakedja) |
| ViewModel | initialt tillstånd, varje händelse → nytt tillstånd, feltillstånd; Turbine; injicerad dispatcher |
| Repository | mot repots fake eller kontrakt – aldrig mot den riktiga databasen |
| Skärm som använder en ram | ramens kontraktstest + bara det unika |
| Delad komponent eller ram | Robolectric-test, skärmdump ljust + mörkt, plats i `ComponentGallery` |
| Hook eller dokumentkontroll | Nodetest med ett godkänt och ett underkänt exempel |
| Bugfix | **först** ett test som reproducerar buggen och faller, sedan fixen |

## Mönster

- **Fake framför mock för datalagret.** MockK för samverkande beroenden som inte rimligen går att
  fejka.
- **Injicera dispatcher och klocka;** kalla aldrig `Dispatchers.IO` eller den riktiga klockan
  direkt i testbar kod (skill `android:kotlin-coroutines`).
- **Turbine** för `StateFlow`/`Flow`, inte manuell `collect`. Engångshändelser i tillståndet
  testas med kvittering och `expectNoEvents()` (skill `android:kotlin-flows`).
- **Separera skärm från tillstånd:** testa `*Content`-funktionen utan ViewModel och Hilt.
- **Nytt konstruktorberoende på en ViewModel** → alla dess tester får beroendet.
- **DRY i tester:** ramar och byggstenar testas en gång, grundligt; feature-tester återanvänder
  hjälparna. Samma uppställning på två ställen → en hjälpare innan det tredje. `cpdCheck` täcker
  även testkällor.
- **Testnamn:** svenska meningar i backticks i JVM-tester; i `androidTest` och delade
  enhetstester vanliga identifierare utan mellanslag och kommatecken – D8 kan inte dexa sådana
  metodnamn.
- **Testdata är syntetisk** – aldrig utdrag ur användarens riktiga data.
- **Assertera på beteendet**, även när data saknas: "kunde inte beräknas" är inte samma sak som 0.

## Skärmdumpar (Roborazzi)

- Varje delad komponent och varje ramtillstånd: ljust + mörkt.
- Deterministik: fasta mått, animationer av eller i testklockan, ingen riktig klocka, inga
  slumpvärden. En bild som skiljer mellan körningar är flaky och ska göras deterministisk.
- **Avsiktlig designändring** → `./gradlew :app:recordRoborazziDebug` och nya bilder i **samma**
  PR, med före/efter i PR-beskrivningen.
- **Oväntad diff** är en bugg eller regression – aldrig något som "bara spelas in på nytt".
  Toleransen höjs aldrig för att få grönt.

## Innan du anser dig klar

Kör repots kommandon för det du ändrat **lokalt innan varje push** – en röd CI-runda är det
dyraste som finns. Saknar molnsessionen Android SDK: installera den med repots
`.claude/hooks/install-android-sdk.sh` (alltid ok). Går ett kommando inte att köra: säg det i
PR:en. Vid rött CI – låt agenten `android:ci-doktor` diagnostisera.

## Fallgropar

- **`LC_ALL=C.UTF-8`** krävs för Gradle i sessionen (kotlinc kraschar på svenska testnamn); repots
  `.claude/settings.json` sätter den när repot är projektroten, annars exportera den själv.
- **Första Gradle-körningen i en ny session** hämtar Gradle, plattformen och beroendena (flera
  minuter). Kör den i bakgrunden och fortsätt med annat.
- **Två Gradle-körningar samtidigt** låser varandra eller ger förvirrande cachefel – vänta in den
  första.
- **Plattformspaketet heter `android-37.0`**, inte `android-37`, från API 37.
- **Maven Central svarar 429** till sessionens Gradle (färre workers räcker inte alltid). Repots
  session-start-hook lägger `maven-central-mirror.init.gradle.kts` i `~/.gradle/init.d/`, som
  byter `repo.maven.apache.org` mot Googles spegel `maven-central.storage-download.googleapis.com`.
  Saknas filen där: kopiera den från repots `.claude/hooks/` och kör om en gång, inte i en slinga.
- **En knapp under skärmkanten** är komponerad men klicket landar inte: `performScrollTo` (eller
  `performScrollToIndex` i en lat lista) före klicket.
- **En DataStore eller annan scope på egen dispatcher** gör att `awaitItem()` väntar på riktig tid
  och ibland överskrider Turbines timeout i CI – ge den testets dispatcher.

## Anti-mönster

- Ta bort, `@Ignore`:a eller försvaga ett rött test för att bli klar.
- Köra om ett test tills det blir grönt.
- Testa implementation (interna anrop) i stället för beteende.
- Ett test som går mot nätet eller mot den riktiga databasen.
- Skriva om ramens beteendetester i varje feature i stället för att köra kontraktet.
- Spela in nya referensbilder för att tysta en diff du inte förstår.
- Ny funktion utan test "för att den är liten".
- Låta `main` kompilera medan en fake i test slutat matcha sitt interface.
