---
name: implement-issue
description: Genomföra ett GitHub-issue, en bugg, en funktion eller ett underhållsjobb i ett Android-repo från issue till mergad PR – stommen i skill android:arbetsflode plus Android-delarna – mockup för ny GUI, återbruk av delade delar och android-ui, implementera med tester på varje nivå, datakedjan, höj versionen, android:granskare och /code-review, emulatortesterna. Repodetaljerna står i repots android-projekt. Use when the user wants to "implement issue #N", "fix this bug", "build this feature", "do this ticket", "pick up #N", or hands off from refine-issue. Trigger-ord: genomför, implementera, kör #N, kör nästa, driv på, fixa buggen, bygg funktionen, ta issue, PR.
---

# Genomföra ett issue i ett Android-repo

**Stommen står i skill `android:arbetsflode` → Issue till PR** (förra PR:en, förstå, bygg,
kontroller, granskningsrundor, en push, PR-texten, bevakning, konflikter, merge). Följ den steg
för steg; den här skillen säger vad som läggs till i ett Android-repo, under stommens
stegnummer. Repodetaljerna (owner/repo, basbranch, lager, datakedjan, agenter, kommandon) står i
repots `android-projekt` → **Arbetsflöde**; där pluginen och repot krockar gäller repot.

> **Tester körs lokalt före push, CI bekräftar** (repots skill `testing-strategy`, "Innan du
> anser dig klar"). Tester mot en databas körs bara mot emulatorn, aldrig mot den riktiga databasen.

Skälet till en PR i taget är konkret här: parallella PR:er mot samma bas krockar nästan alltid
på kravlistan, README och versionen.

## 1. Förstå – Android-tillägg

- Kommentarer med rubriken "Tillägg" ändrar eller kompletterar kontraktet. Issuets
  **Återbruk** hör till kontraktet.
- Oklart eller riskabelt omfång → `android:refine-issue` först.
- Mockup: tabellen i skill `android:mockup`; mallen och datan i `android-projekt` → "Mockup".

## 2. Bygg – Android-tillägg

**Hitta mönster och delade delar först.**

- Öppna en syskon-ViewModel/skärm/repository och följ dess form (skill `android:android-dev`).
- Slå upp komponenter, ramar och byggstenar i repots skill `shared-ui-components`. Rör du en
  känd dubblett – slå ihop den först. Saknas något delat → egen commit före funktionen.
- Delen finns i **android-ui** (import `se.partee71.ui.*`) → ändringen görs där, inte i appen
  (skill `android-dev` → android-ui): PR i ParTee71/android-ui med test, skärmdump och höjd
  version → merge → tagg `v<version>` (publicerar) → appens PR höjer versionen i katalogen.
  Appens PR väntar tills versionen är publicerad.
- Data → repots skill `data-safety-backup`; domänskills (beräkningar, larm, externa källor):
  `android-projekt` → Arbetsflöde. Mappa till kravlistans ID:n (repots `requirements-kravlista`).

**Delegera på rätt nivå:** huvudsessionen orkestrerar och granskar; repots agenter står i
`android-projekt` → Arbetsflöde. Tester på tre eller fler nivåer till agenten
`android:testskrivare`. Går ett steg fel två gånger i rad flyttas det upp en nivå. Saknas
Agent · modell · effort i issuet: komplettera det först (`android:refine-issue`).

**Implementera:** `Compose → ViewModel(StateFlow<UiState>) → Repository → datalagret`, Hilt,
fel mappas i datalagret.

- Listskärmar och formulär på repots ramar (`shared-ui-components`). Injicera dispatchers.
- **Persisterad data:** hela kedjan i samma ändring (repots `data-safety-backup`).
- **Version:** avsnittet Versionshöjning i skill `android:release`, med raden i README:s
  versionshistorik.
- Svenska UI-strängar i `strings.xml`; återanvänd återkommande texter.
- Logga aldrig innehåll eller PII; semantik och tryckytor i komponenterna.
- Hooken `regel4-check` säger till direkt om ett förbjudet mönster skrivs – rätta innan du går vidare.

**Tester på varje berörd nivå** (repots `testing-strategy`): kontraktstesterna för skärmar på
ramarna, testa bara det unika; nya komponenter får skärmdump ljust + mörkt och plats i
`ComponentGallery`.

- Skärmdumpstoleransen är repots parameter. Höj den aldrig för grönt – spela in på nytt bara
  vid avsiktlig designändring.
- **Manifest eller byggfiler ändrade** → lint och release-bygget lokalt före push (kommandona i
  `android-projekt` → Arbetsflöde); de körs inte i PR-flödet (repots `ci-budget`).

## 4. Granska – Android-tillägg

Granskaren är agenten **`android:granskare`**. Den kontrollerar också att en funktions-PR har
höjt versionen (semver efter ändringen, `versionCode` +1, raden i README:s versionshistorik) och
att en ren dokument-, test- eller CI-ändring inte har gjort det – saknad höjning är ❌.
`/code-review` körs dessutom när ändringen rör något i repots lista (`android-projekt` → Arbetsflöde).

## 5. PR – Android-tillägg

- Titel `<område>: <sammanfattning>`; repots commit-områden i `android-projekt` → Arbetsflöde.
- PR-texten säger hur ändringen uppfyller de fem reglerna, krav-ID:n som ändrats eller
  uppfylls, och byggtidseffekt vid nya beroenden. Repots tillägg: `android-projekt` → Arbetsflöde.

## 6. Bevaka – Android-tillägg

- Rött CI → agenten **`android:ci-doktor`**.
- Emulatorjobbet går ofta kvar efter att Gradle-jobbet fallerat – vänta tills körningen är
  `completed` innan en omkörning (`rerun_failed_jobs`).
- **Körs emulatortesterna** (när PR:en rör koden de testar – repots `ci-budget`) **måste de vara
  gröna för merge.** Ett hoppat jobb är okej, ett rött eller avbrutet är det inte.

## Anti-mönster (utöver stommens)

- Persisterad ändring utan hela datakedjan och rundturstest.
- En lokal variant av en delad komponent eller ram, eller en tredje kopia av en känd dubblett.
- Publik `fun` på en ViewModel när projektet använder sealed events + `onEvent()`.
- `@Ignore` på ett rött test eller höjd skärmdumpstolerans för att bli grönt.
- Funktions-PR utan versionshöjning.
