---
name: implement-issue
description: Genomföra ett GitHub-issue, en bugg, en funktion eller ett underhållsjobb från issue till mergad PR — kontrollera att föregående PR är mergad, förstå arbetet, mockup för ny GUI, återbruk av delade delar, implementera med tester på varje nivå, höj versionen, självgranska med agenten granskare och /code-review i rundor, committa, pusha, öppna PR och bevaka den. Repodetaljerna står i repots android-projekt. Use when the user wants to "implement issue #N", "fix this bug", "build this feature", "do this ticket", "pick up #N", or hands off from refine-issue. Trigger-ord: genomför, implementera, kör #N, kör nästa, driv på, fixa buggen, bygg funktionen, ta issue, PR.
---

# Genomföra ett issue (bugg · funktion · underhåll)

Motsvarigheten till `android:refine-issue`: driver en ändring från issue till PR enligt de fem
reglerna i repots CLAUDE.md. Hoppa inte över steg – reglerna är definitionen av klart.
Repodetaljerna (owner/repo, basbranch, lager, datakedjan, agenter, kommandon) står i repots
`android-projekt` → avsnittet **Arbetsflöde**; där pluginen och repot krockar gäller repot.

> **Tester körs lokalt före push, CI bekräftar** (repots skill `testing-strategy`, "Innan du
> anser dig klar"). Kan något inte köras lokalt får CI testa – säg det i PR:en. Tester mot en
> databas körs bara mot emulatorn, aldrig mot den riktiga databasen.

## Steg 0 – Föregående PR och branch (alltid först)

En PR i taget mot basbranchen (`master` om inte `android-projekt` → Arbetsflöde säger annat),
och sessionen har normalt en enda arbetsbranch.

1. Hämta den senaste PR:en från arbetsbranchen med `mcp__github__list_pull_requests`
   (owner och repo ur `android-projekt`, head `<branch>`, state `all`) och
   `mcp__github__pull_request_read`. **Lita aldrig på ett antagande eller på att någon sagt
   "mergad" – fråga GitHub.**
2. **Mergad** → `git fetch origin master && git checkout -B <branch> origin/master`. Avsluta
   bevakningen av den gamla PR:en (`unsubscribe_pr_activity`) och ta bort dess check-in.
3. **Öppen** → säg direkt till användaren att den inte är mergad och att nytt arbete annars
   hamnar i samma PR. Vänta på besked, eller förbered arbetet i en lokal commit utan push.
   **Återställ aldrig branchen från `master` innan mergen bekräftats** – det tappar
   PR:ens commits lokalt.
4. Ingen PR alls → skapa branchen från `origin/master`. Committa aldrig direkt på `master`.

Skälet är konkret: parallella PR:er mot samma bas krockar nästan alltid på kravlistan,
README och versionen.

## Steg 1 – Förstå arbetet

- Hämta issuet **och dess kommentarer**: `mcp__github__issue_read` (metod `get` och
  `get_comments`). Acceptanskriterier, Design, Återbruk och **Agent · modell · effort** är
  kontraktet; kommentarer med rubriken "Tillägg" ändrar eller kompletterar det och gäller före
  issuetexten.
- Oklart eller riskabelt omfång → kör `android:refine-issue` först eller bekräfta omfånget.
- Klassa: bugg, funktion eller underhåll.

## Steg 2 – Mockup (ny GUI)

Kräver issuet ny eller tydligt ändrad GUI (tabellen i skill `android:mockup`; mallen och datan i
`android-projekt` → "Mockup") och det finns ingen godkänd mockup under **Design** → gör
mockupen, visa den och **vänta på ok** innan kod.

## Steg 3 – Återskapa (bugg) / sikta (funktion)

- **Bugg:** exakt återskapande, förväntat mot faktiskt, hitta felande kodväg. Reproduktionen
  blir ett test som faller.
- **Funktion/underhåll:** exakt var ändringen görs och vilket synligt utfall som betyder klart.

## Steg 4 – Hitta befintliga mönster och delade delar

- Öppna en syskon-ViewModel/skärm/repository och följ dess form (skill `android:android-dev`).
- Slå upp komponenter, ramar och byggstenar i repots skill `shared-ui-components`. Lista vilka
  som används. Rör du en känd dubblett – slå ihop den först.
- Saknas något delat → planera det som **egen commit före** featuren.
- Data → repots skill `data-safety-backup` (och datalagrets skill, se `android-projekt` →
  Arbetsflöde). Repots domänskills (beräkningar, larm, externa källor) står i samma avsnitt.
- Mappa till kravlistans ID:n (repots skill `requirements-kravlista`) och befintliga tester.

## Steg 5 – Planera och delegera

Kort plan: filer, ordning, tester, datakedjan, krav, version. Arkitektoniskt betydande eller
tvetydigt → fråga användaren innan kod (`AskUserQuestion` där det finns, annars ett
beslutskort eller en kort fråga i tråden).

**Delegera på rätt nivå:** huvudsessionen orkestrerar och granskar; repots agenter och vad de
tar står i `android-projekt` → Arbetsflöde. Tester på tre eller fler nivåer till `testskrivare`.
Går ett steg fel två gånger i rad flyttas det upp en nivå.

**Kör agenten som issuet anger.** Läs issuets avsnitt **Agent · modell · effort** och starta
varje del med just den agenten, modellen (`model`) och effort (`effort`) – det är det
uttryckliga beslutet som Agent-verktygets `effort` kräver. Saknas avsnittet: komplettera issuet
först (skill `android:refine-issue`, steg 6). Avvikelse bara uppåt (fel två gånger i rad, eller
större risk än väntat) och motiveras i PR-beskrivningen. Modellvalet:

| Uppgift | Modell |
|---|---|
| Uppslag och läsning – loggar, data, sökningar | Haiku |
| Små avgränsade ändringar – en fil, en komponent, ett test | Sonnet |
| Flera lager, datamodell, migrering, backup och granskning | Opus |
| Väldigt komplexa issues – anges då i issuet | Fable |

Opus är standard.

## Steg 6 – Implementera (tester samtidigt, inte efter)

`Compose → ViewModel(StateFlow<UiState>) → Repository → datalagret`, Hilt, fel mappas i
datalagret (repots kedja: `android-projekt` → Arbetsflöde).

- **Bugg:** regressionstest som faller först, sedan minsta ändringen som gör det grönt.
  Utöka inte omfånget medan du är där.
- **Funktion:** delade delar först (egen commit), sedan featuren ovanpå. Listskärmar och
  formulär på repots ramar (skill `shared-ui-components`). Injicera dispatchers.
- **Persisterad data:** hela kedjan i samma ändring (repots skill `data-safety-backup`).
- **Version:** ändrar PR:en appens beteende höjs versionen i samma ändring (avsnittet
  Versionshöjning i skill `android:release`), med raden i README:s versionshistorik.
- Svenska UI-strängar i `strings.xml`; återkommande texter finns redan – återanvänd.
- Logga aldrig innehåll eller PII; semantik och tryckytor i komponenterna.
- Hooken `regel4-check` säger till direkt om ett förbjudet mönster skrivs – rätta innan du går vidare.

## Steg 7 – Tester på varje berörd nivå

Enligt repots skill `testing-strategy`: kör kontraktstesterna för skärmar på ramarna, testa bara
det unika; uppdatera – ta aldrig bort eller försvaga – befintliga tester; nya komponenter
får skärmdump ljust + mörkt och plats i `ComponentGallery`.

- **Skärmdumpar:** toleransen i jämförelsen är repots parameter (repots `testing-strategy`).
  Höj den aldrig för att få grönt – en avvikelse spelas in på nytt bara vid avsiktlig designändring.
- **Manifest eller byggfiler ändrade** → kör lint och release-bygget lokalt före push
  (kommandona i `android-projekt` → Arbetsflöde). De körs inte i PR-flödet (repots `ci-budget`).
- **Flaky är en bugg:** hitta grundorsaken och gör testet deterministiskt. Kör aldrig bara om.

## Steg 8 – Självgranskning

Kör agenten **`granskare`** på diffen. Varje ❌ åtgärdas; ett ⚠️ åtgärdas om det är litet,
annars nämns det i PR:en. Spåra varje acceptanskriterium till kod eller test och till
issuets **Verifiering** – kör de kommandona. Kan du inte det är du inte klar.

Granskaren kontrollerar också att **en funktions-PR har höjt versionen** (semver efter
ändringen, `versionCode` +1, raden i README:s versionshistorik) – och att en ren dokument-,
test- eller CI-ändring inte har gjort det. Saknad höjning är ❌.

Rör ändringen domänlogik, datalagret, schemat eller rules, backup-kedjan, en extern källa eller
en delad ram/komponent (repots lista: `android-projekt` → Arbetsflöde) – eller är diffen större
än ett par filer – kör dessutom den inbyggda **`/code-review`** på diffen, *efter* `granskare`
och innan push. `granskare` kontrollerar reglerna; `/code-review` letar buggar. Verifiera
varje fynd och åtgärda de verkliga. Rena dokument- och strängändringar behöver den inte.

Ändras koden efter granskningen (rättningar av fynden) granskas rättningarna igen – `granskare`
och `/code-review` på bara det som ändrats sedan förra rundan, och bara mot ❌ och buggar –
innan push. Rundorna slutar när en runda inte hittar något ❌; ⚠️ i en senare runda nämns i
PR:en i stället för att starta en ny. En PR går aldrig ut med kod som ingen granskning sett.

## Steg 9 – Commit och push

- Konventionella meddelanden, gärna svenska: `feat(<område>): …`, `fix(<område>): …`,
  `test(...)`, `docs(...)`, `chore(...)` (repots områden: `android-projekt` → Arbetsflöde).
  Små, sammanhängande commits. `Closes #N` i den sista. Avsluta med de commit-trailers som
  sessionen anger.
- Kör kontrollerna lokalt (repots skill `testing-strategy`) och pusha först när de är gröna.
- `git push -u origin <branch>` (försök igen med backoff vid nätverksfel).

## Steg 10 – Pull request och bevakning

- Mot `master`. Titel `<område>: <sammanfattning>`. Innehåll: vad som ändrats, hur det
  uppfyller de fem reglerna, krav-ID:n som ändrats eller uppfylls, **versionen** (eller "ingen
  höjning – ren dokument/test/CI"), testplan (och vad som inte kunde köras lokalt),
  byggtidseffekt vid nya beroenden, `Closes #N`, och för GUI: mockup-länk + skärmdumpar
  (ljust/mörkt). Repots tillägg: `android-projekt` → Arbetsflöde.
- **Prenumerera direkt** (`subscribe_pr_activity`) utan att fråga, och schemalägg en check-in.
  Bevaka tills den är mergad eller stängd; hantera granskningskommentarer.
- Rött CI → agenten **`ci-doktor`** diagnostiserar; fixa grundorsaken och pusha. Kör aldrig
  bara om.
- **Körs emulatortesterna** (instrumenttesterna, när PR:en rör koden de testar – repots
  `ci-budget`) **måste de vara gröna för merge.** Ett hoppat jobb är okej, ett rött eller
  avbrutet är det inte.
- Har användaren bett om automatisk merge när den är grön: kontrollera att alla
  kontroller på senaste commit är gröna och att PR:en är konfliktfri, merga med
  `merge_pull_request` (metod `merge`, `expectedHeadSha`), avsluta bevakningen och gå
  tillbaka till steg 0 för nästa issue.
- **Verktyg:** GitHub MCP (`mcp__github__*`); ingen `gh`.

## Flera issues

Ett i taget, var och en med egen PR. Blanda aldrig orelaterade ändringar i samma branch.
Att förbereda nästa på en lokal branch går bra – det är PR-öppning till merge som sekvenseras.

## Anti-mönster

- Påbörja nästa issue utan att ha frågat GitHub om föregående PR är mergad.
- Kod för ny GUI utan godkänd mockup.
- Bugfix utan regressionstest.
- Persisterad ändring utan hela datakedjan och rundturstest.
- En lokal variant av en delad komponent eller ram, eller en tredje kopia av en känd dubblett.
- Publik `fun` på en ViewModel när projektet använder sealed events + `onEvent()`.
- Ta bort eller `@Ignore`:a ett rött test, höja skärmdumpstoleransen eller köra om för grönt.
- Funktions-PR utan versionshöjning, eller en agent med annan modell eller effort än issuet anger.
