---
name: ci-budget
description: Generell CI-budget för Android-repona (regel 5) — en PR kostar högst ca 8 Actions-minuter, instrumenttesterna bara när PR:en rör koden de testar, tester bara när deras kod ändrats, lint och release-bygge utanför PR-flödet. Ladda tillsammans med repots egen ci-budget (tabellen över vad som körs när) vid .github/workflows, Gradle-inställningar, nya beroenden, plugins, moduler eller testnivåer, och när CI är långsam. Trigger-ord: CI, GitHub Actions, workflow, android.yml, byggtid, Actions-minuter, cache, paths-filter, concurrency, emulator, lint, release-bygge, nytt beroende, budget.
---

# CI-budget (generellt)

**Repots skill `ci-budget` går före det här.** Där står tabellen över vad som körs när (enda
källan, kontrolleras mot `android.yml` där repot har en dokumentkontroll), jobbens namn, repots
mätta siffror och avsnittet **Felklasser** som agenten `android:ci-doktor` läser.

## Regeln

- En PR kostar högst ca **8 Actions-minuter** på varm cache, plus instrumenttesterna på
  Android-emulator **bara** när PR:en rör koden de testar. `timeout-minutes` är ett skyddsnät,
  inte en budget.
- **Tester körs bara när koden de testar har ändrats.** Ett snabbt jobb (`changes`, med
  `dorny/paths-filter`) avgör vilka jobb som körs; Gradles build cache hoppar dessutom över
  oförändrade testtasks. Att slippa köra ett test är aldrig ett skäl att inte skriva det (skill
  `android:testing-strategy`).
- **Lint och release-bygge (R8) hör inte till PR-flödet** utan uttryckligt beslut. De körs på
  begäran, veckovis (bara om `master` ändrats) och vid release.
- **Release kör inget två gånger:** en snabb grind kontrollerar version, secrets och CI-resultatet
  på commiten i stället för att köra om det, och instrumenttesterna hoppas över när samma kod
  redan testats grönt i en PR.
- **Nya beroenden, plugins eller moduler** får inte fördubbla byggtiden – ange uppmätt effekt i
  PR:en.
- **Privata repon delar kontots minutkvot** (2 000 min/mån); publika repon kostar inget. Ju
  närmare kvoten, desto viktigare är det att pusha en gång när allt är lokalt grönt.

## Formen på `android.yml`

- `changes` startar alltid (sekunder), kör **dokumentkontrollerna** och sätter filtren. Snabba
  kontroller utan JDK (hooktest, Nodetester utan beroenden) blir steg här, inte egna jobb.
- Ett Gradle-jobb kör **en** Gradle-körning med `--continue` för det filtren säger.
  Testrapporter laddas alltid upp; Roborazzi-diffar och CPD-rapporten vid fel.
- Emulatorn körs bara i instrumentjobbet, bakom sitt eget filter, bara i PR. Körs det måste det
  vara grönt för merge.
- **Hoppade jobb rapporterar ingen status.** Därför är `ci-ok` (`needs:` alla jobb,
  `if: always()`) det enda obligatoriska statuskravet. Det godtar `success` och `skipped` och
  fäller allt annat.
- `push` till `master` sätter filtren till sant (utom instrumenttesterna, som PR:en kört) –
  baslinje och cache-uppvärmning.

## Tekniker som håller tiden nere

- `gradle/actions/setup-gradle`: cachen skrivs från `master`, läses i PR.
- `org.gradle.caching=true`, `org.gradle.parallel=true` och configuration cache där repot klarar
  den.
- `concurrency` per workflow och ref, `cancel-in-progress` bara för PR – `master` och
  release-grindarna avbryts aldrig.
- Robolectric-SDK-jar och emulatorbilder cachas.
- Gemensamma steg i composite actions (t.ex. `.github/actions/setup-android`) – en ändring, alla
  flöden. `setup-android` provar `GPR_TOKEN` mot android-ui först och stoppar på en sekund om den
  saknas eller är fel (skill `android:android-gradle-logic`).
- Varje jobb debiteras uppåt till hel minut – slå ihop korta steg i ett jobb hellre än att lägga
  till jobb.

## När du lägger till något

- **Nytt beroende eller plugin:** ange uppmätt byggtidseffekt i PR-beskrivningen. Är det
  R8-känsligt: keep-regler och en manuell körning av kvalitetsflödet på PR-grenen före merge.
- **Ny testnivå eller nytt verktyg:** lägg det bakom rätt filter i JVM-jobbet; aldrig
  ovillkorligt och aldrig i emulatorjobbet om det inte kräver enhet.
- **Ny modul:** ny rad i repots tabell **och** nytt filter i samma PR.
- **Över budget:** eget issue med mätning och förslag – aldrig en tyst höjning av timeouten.
- **Lokalt före push** (repots `testing-strategy`): de kontroller ändringen berör, aldrig
  `./gradlew test` av vana. Lokala körningar kostar inga Actions-minuter – en röd CI-runda gör det.
- **Omkörning** bara när orsaken är åtgärdad utanför koden, och först när hela körningen är klar
  (skill `android:implement-issue`, steg 10).

## Anti-mönster

- `paths-ignore` på workflow-nivå (dokumentändringar skulle då aldrig kontrolleras).
- Göra ett villkorat jobb till obligatoriskt statuskrav (ett hoppat jobb blockerar PR:en).
- Starta emulatorn "bara den här gången" i en PR som inte rör instrumenttesternas kod.
- Kopiera setup-steg mellan workflows i stället för en composite action.
- Höja `timeout-minutes` i stället för att hitta orsaken till att det blev långsamt.
- Pusha för att se om CI blir grönt, eller köra om för att se om det var en slump.
