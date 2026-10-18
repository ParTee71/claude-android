---
name: release
description: Release-flödet för en Android-app — versionen är redan höjd i funktions-PR:en, så releasen frågar inte om numret; kontrollera version, README-raden och kravlistan, trigga repots release-workflow via workflow_dispatch så att GitHub Actions kör grindarna (tester bara där samma kod inte redan testats grönt), skapar taggen, bygger den signerade APK:n och publicerar en GitHub Release, och avsluta med APK-länken. Innehåller också regeln för versionshöjning i funktions-PR:en. CI-först (fungerar från telefonen). Använd BARA när användaren uttryckligen ber om en release. Use when the user asks to "release", "ship", "publish a version", "cut a release". Trigger-ord: release, släpp, ny version, publicera, versionshöjning, semver, versionCode, versionName, bygg APK, signerad APK.
---

# Release

Kör stegen i ordning och rapportera efter varje steg. Stanna och förklara om något fallerar.
**Kör bara när användaren uttryckligen ber om en release.** Versionsfilen, workflowen och dess
inputs, jobben, hemligheterna och repots extra steg står i repots `android-projekt` → avsnittet
**Release**; där pluginen och repot krockar gäller repot.

## Versionshöjning i funktions-PR:en

Varje PR som ändrar appens beteende höjer versionen i samma ändring, så att ingen separat
release-PR behövs. Välj semver efter ändringen:

| Ändring | Höjning |
|---|---|
| Brytande eller borttagen funktion, eller backupformat som äldre appar inte läser | **major** |
| Ny funktion – ny skärm, ny förmåga | **minor** |
| Fix, chore, refactor, beroenden | **patch** |

Höj `versionCode` med 1, uppdatera versionsfilen (`android-projekt` → Release) och skriv
**raden i README:s versionshistorik** med de användarsynliga ändringarna och `(#NN)` – i
funktions-PR:en, inte vid release. Skriv versionen i PR-beskrivningen. Ren dokument-, test- eller
CI-ändring utan effekt i appen höjer inte. Är versionen redan höjd sedan senaste tagg, höj bara
om denna PR är allvarligare (då skrivs den befintliga README-raden om till den nya versionen).
Agenten `granskare` kontrollerar höjningen (skill `android:implement-issue`, steg 8).

## Hur en release går till

- **Ingen fråga om versionsnumret** (användarens beslut): releasen använder versionen som
  funktions-PR:erna redan satt på `master`.
- **Snålt med Actions-minuter (repots skill `ci-budget`):** releasens grindar kör testerna, utom
  de som redan körts gröna på samma kod (master-pushen och PR:ens emulatortester körs inte om).
  Lint och det signerade, minifierade bygget körs i releasen.
- **Starta releasen först när CI på `master` är grönt** för HEAD – annars släpps oprövad kod,
  eller grinden stoppar den direkt.
- **Bygg och signering:** i Actions; keystore och lösenord från secrets. Ingen lokal SDK krävs.
- **Publicering:** release-workflowen skapar taggen `vX.Y.Z` själv och publicerar en GitHub
  Release med changelog och APK. Två triggers: push av tagg, eller `workflow_dispatch` på
  `master`.
- **Ett fallerat jobb:** läs loggen (`get_job_logs`, eller agenten `ci-doktor`), fixa
  grundorsaken och kör om bara det som föll (`rerun_failed_jobs`) – aldrig hela releasen, och
  aldrig en omkörning för att se om det var en slump.
- **Taggar pushas aldrig från en agentsession** – nätverkspolicyn blockerar `refs/tags/*`
  (HTTP 403). Använd dispatch-vägen. Branch-pushar påverkas inte.
- **Verktyg:** GitHub MCP (`mcp__github__*`); ingen `gh`.

## Steg 1 – Version och senaste tagg

Läs `versionCode` och `versionName` i versionsfilen på `origin/master`. Senaste tagg:
`mcp__github__list_tags` / `mcp__github__get_latest_release`. Commits sedan dess:
`git log <tagg>..origin/master --oneline --no-merges`.

- **Versionen är högre än taggen** → det är den som släpps. Kontrollera att den allvarligaste
  ändringen i intervallet stämmer med höjningen (tabellen ovan); stämmer den inte, säg det.
- **Versionen är lika med taggen** och intervallet har bara dokument, test eller CI → inget att
  släppa; säg det och stanna.
- **Versionen är lika med taggen** men appen har ändrats → en funktions-PR har missat höjningen.
  Höj enligt tabellen i en liten PR (skill `android:implement-issue`) – fråga inte om numret,
  säg vilken version det blir och varför – och fortsätt när den är mergad.

## Steg 2 – README, krav och repots förberedelser

1. README:s versionshistorik har en rad för `<version>` (skriven i funktions-PR:erna). Saknas
   den, eller saknar den användarsynliga ändringar ur intervallet → komplettera i en liten PR.
2. Kontrollera att kravlistan speglar det som släpps (inga kvarvarande *(planerad)* för byggda
   funktioner) och att plattformskraven matchar SDK-nivåerna i byggfilen.
3. Repots egna steg före bygget (schema- eller backupformat som höjts, rules, datafiler som
   uppdateras före release): `android-projekt` → Release. Kräver de något av användaren, vänta
   på bekräftelse innan steg 3.

## Steg 3 – Trigga release-bygget

När CI är grönt på `master`:
```
mcp__github__actions_run_trigger
  owner: <owner>, repo: <repo>
  workflow_id: <release-workflow>, ref: master
  inputs: <se android-projekt → Release>
```
Versionen anges utan `v`; booleska inputs som strängar (`"true"`). Workflowen vägrar om
taggen redan finns, så en upprepad dispatch skriver aldrig över en publicerad Release.

Följ körningen: `actions_list` → `actions_get` → vid fel `get_job_logs` (`failed_only`) eller
agenten `ci-doktor` → `get_release_by_tag` för `v<version>`.

**Manuell reserv:** från användarens egen dator `git tag v<version> && git push origin v<version>` –
samma workflow. Erbjud bara om dispatch-vägen inte fungerar.

## Steg 4 – Sammanfattning med APK-länk

Avsluta **alltid** med länken till APK:n – appen installeras från telefonen, och "bygget är
grönt" utan länk tvingar fram ett extra steg. Ange commit och `versionName`.
```
Släppt:  <App> v<version>  (versionCode <n>)
Commit:  <sha> på master
Tagg:    v<version> (skapad av release-workflowen)
CI:      <länk / status>
APK:     <Release-länk> (signerad <app>-<version>-<tidsstämpel>.apk)
```
Samma regel för ett testbygge utan Release eller en debug-snapshot (länk till artifacten eller
releasesidan), om repot har sådana (`android-projekt` → Release).

## Reserv – bygga lokalt i Android Studio

`./gradlew :app:assembleRelease` kräver keystore och signeringslösenord via `local.properties`
eller miljövariabler (repots `android-projekt` → Release och skill för integritet). Checka aldrig
in keystoren. För en publicerad Release, kör ändå steg 3.
