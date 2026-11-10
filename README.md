# claude-android

Gemensam Claude Code-plugin för Mats projekt. Det mesta är för Android-repona
ReseApoteket, Dagboken, fonder och biblioteket android-ui: Kotlin, Compose, Navigation 3 och
arbetssättet kring issues och PR:er. Några delar gäller alla repon, också Husjakt och
VeckansMat: arbetsreglerna (`arbetsregler`), arbetsflödets stomme (`arbetsflode`), modellvalet (`ai-model-choice`), uppsättningen för projekttrådar
(`scripts/repo-plugins.mjs`, `repo-hook.mjs`) och sessionsstartens kontroll (`setup-check`). Det som är eget för ett repo stannar i repots `.claude/`, och där
de krockar gäller repots CLAUDE.md.

Vilka konton, tjänster, nycklar, Claude-miljöer och gratiskvoter alla repona hänger på står
i [DRIFT.md](DRIFT.md).

## Skills

Skillsen anropas som `android:<namn>`.

| Skill | När |
|---|---|
| `android-dev` | Baslinje för allt Android/Kotlin-arbete, med plattformskraven (targetSdk 36, Material 3 beta/stabil, Baseline Profile, ktlint via Spotless, Renovate/Dependabot) och komponentbiblioteket `android-ui` (sök där först). |
| `compose-expert` | Compose: state, stabilitet (`@Immutable` UiState med listor), `key`/`contentType` i listor. |
| `kotlin-coroutines` | Coroutines; dispatchers injiceras, `Dispatchers.` bara i `di/`. |
| `kotlin-flows` | Flows; engångshändelser i UiState som UI:t kvitterar. |
| `accessibility-compose` | TalkBack, tryckytor, stor text, färg och diagram. |
| `android-gradle-logic` | Versionskatalog, delad byggkonfiguration, convention plugins, `android-ui` från GitHub Packages. |
| `firebase-auth` | Google-inloggning med Credential Manager + Firebase Auth. |
| `mockup` | Mockup före ny GUI. |
| `ux-granskning` | Designkritik och UX-texter för en skärm, mockup eller skärmdump. Efter Anthropics `design-critique` och `ux-copy`. |
| `arbetsflode` | Arbetsflödets stomme för alla Mats repon: idé till issue (mallen, Agent · modell · effort, stoppet för ok) och issue till PR (förra PR:en via GitHub, test först vid bugg, granskning i rundor, en push, PR-texten, bevakning, `mergeable_state`, konflikter, merge). Enda källan – repons arbetsflödesskills lägger sina steg ovanpå. |
| `refine-issue` | Android-delarna ovanpå `arbetsflode`: kodgenomgång mot de fem reglerna, Definition of Done, rubrikerna Återbruk, Datasäkerhet och Krav. |
| `implement-issue` | Android-delarna ovanpå `arbetsflode`: mockup, återbruk och android-ui, datakedjan, versionshöjning, `android:granskare`, emulatortesterna. |
| `arbetsregler` | Gemensamma arbetsregler för alla Mats projekt: plan i issue och ok bara för större ändringar, små direkt till PR, ärliga svar, agenter med egen modell, driva igenom utan bekräftelsefrågor, en PR i taget, tider i svensk tid, tokentak och agenter vid behov. Enda källan – repons CLAUDE.md länkar hit. |
| `ai-model-choice` | Modellval för sessioner, agenter och issues i alla Mats projekt: Opus 5.5 som standard, Fable 5.2 bara med skäl och medium/high effort. Enda källan – repons CLAUDE.md länkar hit. |
| `release` | Versionshöjningen i funktions-PR:en och releasen via `workflow_dispatch`, utan fråga om versionsnumret. |
| `testing-strategy` | Regel 2 generellt: tester på varje berörd nivå, flaky är en bugg, skärmdumpar, mönster och fallgropar. Repots `testing-strategy` har nivåtabellen, hjälparna och kommandona. |
| `ci-budget` | Regel 5 generellt: ~8 minuter per PR, `changes` + `ci-ok`, emulatorn bara när koden rörs, lint och R8 utanför PR-flödet. Repots `ci-budget` har tabellen över vad som körs när. |
| `navigation-3` | *Googles.* Navigation 3: djuplänkar, flera stackar, scener. |
| `android-intent-security` | *Googles.* Exporterade komponenter och Intents. |
| `firebase-security-rules-auditor` | *Googles.* Granska `firestore.rules`. |
| `firestore-rules-creation` | *Googles.* Skriva och härda `firestore.rules`. |
| `android-permissions-security` | *Googles.* Behörigheter och IPC. |
| `jetpack-compose-performance` | *Googles.* Rekomposition och tappade bildrutor. |
| `r8-analyzer` | *Googles.* Keep-regler och R8. |
| `anr-audit-and-fix` | *Googles.* ANR-risker och stackdumpar. |
| `play-policy-insights` | *Googles.* Play-policyn inför publicering. Har Python-skript (se nedan). |

Googles skills är oförändrade kopior med källa och licens i sina `SOURCE.md`.
`android-dev` → **Specialskills (Googles)** visar vilken som gäller vilken fråga.
`play-policy-insights` har Python-skript som modellen kör när skillen används, aldrig från en hook.
De läser appens källkod, skriver bara under `.scratch/` i arbetskatalogen och hämtar appens
Play-sida och datasäkerhetssida från play.google.com med TLS-verifiering. De startar inga
processer och raderar inget.

Arbetsflödets stomme står i `arbetsflode` och gäller alla repon; VeckansMats `refine-issue` och `implement-issue` och Husjakts `forfina` och `genomfor` lägger sina steg ovanpå på samma sätt som `refine-issue` och `implement-issue` här. Android-skillsen (`refine-issue`, `implement-issue`, `release`) beskriver Android-delen. Repodetaljerna
– owner/repo, agenter, datakedjan, etiketter, versionsfil, release-workflow och dess inputs – står i
repots skill `android-projekt` under avsnitten **Issues**, **Arbetsflöde** och **Release**, och
skillsen hänvisar till repots egna `ci-budget`, `testing-strategy`, `requirements-kravlista`,
`data-safety-backup`, `shared-ui-components` och `ui-style`. `ci-budget` och `testing-strategy`
finns i två lager: det generella här, det repospecifika (tabellen som dokumentkontrollen läser,
hjälparna, kommandona) i repot.

## Agenter

Agenterna anropas som `android:<namn>`. De är generella och läser det repospecifika ur repot.

| Agent | När | Läser i repot |
|---|---|---|
| `granskare` | Före varje PR (`arbetsflode` → Granska i rundor): diffen mot de fem reglerna och mockup-regeln, rapport i en tabell. Sessionens modell. | `CLAUDE.md` och `android-projekt` → **Granskning** |
| `ci-doktor` | Vid rött CI: loggar, skärmdumpsdiffar och CPD-rapporter, föreslår fix utan att pusha. Sonnet. | `ci-budget` → **Felklasser** |
| `testskrivare` | Tester på tre eller fler nivåer, fixturer. Sonnet. | `testing-strategy` → **För testskrivaren** |

Agenter som är för olika mellan repona (`arkitekt`, `byggare`, `db-inspektor`) stannar i repots
`.claude/agents/`.

## Dokumentkontroller

`checks/doc-checks.mjs [repo]` är Android-reponas dokumentkontroll (#59). Den kontrollerar att
relativa länkar och nämnda skills och agenter finns, där `android:<namn>` läses ur pluginen själv.
Den kontrollerar också att `.claude/README.md` listar exakt repots skills och agenter, och att
CI-tabellen i skill `ci-budget` (mellan `ci-table:start` och `ci-table:end`) har samma filter som
`android.yml`. Framåtreferenser står i repots `.github/scripts/link-allowlist.txt`.
`checks/instrumented-paths.mjs` skriver filtret `instrumented` som git-pathspecs åt `release.yml`.
Repots CI checkar ut claude-android (`plugins/android`) till `.claude-android` och kör båda därifrån.

## Hook

`hooks/regel4-check.mjs` är regel 4-kontrollen för Android-repona (#57): PostToolUse efter
Edit/Write och Stop före turens slut, i projektroten eller i varje repo under den. Motorn finns bara
här. Repot har sina mönster, undantag och delade exempel i `app/src/test/resources/` (som
`UiConsistencyTest` också läser) och sina scope, beskedets texter och ev. baslinje i
`.claude/regel4.json`. Repots CI checkar ut claude-android och kör `regel4-check.mjs --verify .`, som
prövar konfigurationen mot mönsterfilen, alla delade exempel, undantagsfilen och baslinjen.
`--baseline` skriver om baslinjen i `ui-allowlist.txt` (repon med `baseline` i konfigurationen).

`hooks/ktlint-check.mjs` kör repots Spotless (ktlint + compose-rules) på varje ändrad `.kt`/`.kts`-fil
(PostToolUse), i alla repon vars root-`build.gradle.kts` använder Spotless. Den går via Spotless
IDE-hook (`-PspotlessIdeHook`), så filen skrivs aldrig om och reglerna läses från repots egen
`ktlintRules`. Regelbrott som `spotlessApply` inte kan rätta, till exempel `lambda-param-in-effect`
och `content-slot-reused`, blockerar med regel och rad. Ren formatering lämnas åt `spotlessApply`.
Med varm Gradle-daemon tar det 1–3 sekunder. Kan kontrollen inte köras säger hooken det, högst en
gång per tio minuter och repo: hinner den inte inom 25 sekunder, eller är Gradle-cachen tom (hooken
kör `--offline`, och en ny molnsession har inga beroenden), blir det en påminnelse om
`spotlessCheck`, och cachen värms i bakgrunden med samma körning utan `--offline` (mätt 78 s i
ReseApoteket; därefter 2 s per fil). Faller Gradle av annat skäl står felets första rad i påminnelsen. Spotless körs inte i CI
(CI-budgeten), så hooken är det som fångar brotten innan push.

Varje besked från hookarna (en regel 4-träff, en Stop-blockering per repo, ett ktlint-brott,
en påminnelse eller ett fynd i självkontrollen) skriver en rad till `/tmp/claude-hooks.log` (eller `$CLAUDE_HOOKS_LOG`): tid,
hook, regel och repo, tabbseparerade. Filinnehåll och kod skrivs aldrig, och en logg som inte går att
skriva stoppar aldrig hooken. Veckomätningen läser filen, eftersom PostToolUse-beskeden inte syns i
sessionens händelseström.

`hooks/setup-check.mjs` körs vid sessionsstart och säger till i sessionens sammanhang när
uppsättningen inte är den som beskrivs här: en plugin som inte gick att ladda (`claude plugin list`
säger "failed to load" – setup-skriptets logg visar bara att installationen lyckades), eller samma
agentnamn i två repon under roten. Tyst när allt stämmer.

`hooks/android-start.mjs` är Android-reponas gemensamma sessionsstart i molnet (#55): för varje
Android-repo under roten (katalog med `gradlew` och `settings.gradle.kts`) skrivs `sdk.dir` i
`local.properties` om raden saknas, Maven Central-spegeln (`hooks/maven-central-mirror.init.gradle.kts`)
läggs i `~/.gradle/init.d/` mot 429-svar, och en rad var säger om SDK:n finns och om `GPR_TOKEN`
saknas för ett repo som hämtar android-ui. Utanför molnet gör den ingenting. Repons egna
`session-start.sh` har bara kvar det som är repots eget.

    node --test plugins/android/hooks/test/*.test.mjs

## Installation

### I molnsessioner (claude.ai/code)

Molnsessioner installerar **aldrig** ett repos `enabledPlugins`. Pluginen installeras därför av
miljöns setup-skript. Repot är publikt, så skriptet klonar det självt när det inte redan ligger i
projektets repolista. Står claude-android i listan används den lokala klonen
(`/home/user/claude-android`), så att en gren med ändringar i pluginen går att prova:

```bash
{
  CA=/home/user/claude-android
  [ -d "$CA" ] || { CA=/opt/claude-android
    if [ -d "$CA/.git" ]; then git -C "$CA" pull -q --ff-only
    else git clone --depth 1 https://github.com/partee71/claude-android "$CA"; fi; } &&
  claude plugin marketplace add "$CA" &&
  claude plugin install android@claude-android
  node "$CA/scripts/repo-plugins.mjs" /home/user
  bash "$CA/scripts/android-sdk.sh"
} >> /tmp/plugin-setup.log 2>&1 || true
```

Raden med `android-sdk.sh` står bara i miljöerna för Android (Android, Dagboken). Den lägger
kommandoradsverktygen och licenserna i `/opt/android-sdk` (155 MB, 11 s), så att SDK:n ligger i
miljöbilden och inte laddas ned i varje tråd. Plattform och build-tools hämtar Gradle själv.

**Pluginens version i en tråd.** Skriptet körs när tråden startar och installerar den version som
då finns på `main` (här i Generella förbättringar den lokala klonen; kontrollerat 2026-11-10 via
`installedAt` och `gitCommitSha` i `~/.claude/plugins/installed_plugins.json`). Finns
`/opt/claude-android` redan i en återanvänd miljöbild hämtar skriptet det senaste i stället för att
klona; med den äldre raden (`git clone` direkt) skulle klonen misslyckas i det läget och tråden få
den gamla versionen (om bilden återanvänds så är inte kontrollerat). Vilken version en tråd har syns med `claude plugin list`.

`|| true` är nödvändigt: ett setup-skript som felar stoppar alla nya sessioner. Gick något fel
står det i `/tmp/plugin-setup.log`. Samma block står i alla molnmiljöer (Android, Dagboken, Webb).

Appprojekten behöver alltså inte ha claude-android i sin repolista. Ett projekt som ska ändra
pluginen (Generella förbättringar) har det.

#### Repons egna skills, agenter och hookar i projekttrådar

En projekttråd startar i `/home/user`, ovanför alla repon, och då laddas inget repos
`.claude/settings.json`. Det som ändå når tråden kommer två vägar:

- **Skills och agenter hittar Claude Code själv** i varje repos `.claude/` under roten (iakttaget
  2026-11-10, #37). En skill heter `<namn>`. Finns samma namn i flera repon får de övriga
  katalogens namn som prefix, med katalogens skiftläge: `fonder:ui-style`, `Dagboken:ui-style`.
  Vilket repo som står utan prefix beror på vilka repon tråden har, så en skill som finns i flera
  repon väljs efter beskrivningen (den börjar med repots namn), inte efter prefixet.
- **Agenter får aldrig prefix.** Samma agentnamn i två repon ger en enda agent, och den andra
  försvinner tyst. Agenter som finns i flera repon heter därför `<repo>-<namn>`
  (`fonder-byggare`, `husjakt-granskare`); en agent som bara finns i ett repo behåller sitt namn.
- **Hookarna** i repots `.claude/settings.json` laddas av sista raden i blocket ovan:
  `scripts/repo-plugins.mjs` gör varje repo med hookar till en lokal plugin i marknadsplatsen
  `repon` (`/home/user/.repo-plugins`). Pluginen bär bara hookar. En plugin som länkar in repots
  skills avvisas av Claude Code ("Path escapes plugin directory"), och en kopia blir gammal,
  eftersom setup-skriptet körs när miljöbilden byggs och repona hämtas på nytt när tråden startar.
  Repona ändras inte.
- Hookarna körs via `scripts/repo-hook.mjs` med repot som `CLAUDE_PROJECT_DIR`, men bara när
  händelsen rör repot:
  - en ändrad fil ska ligga i repot;
  - Stop körs bara när repot har ocommittade filer eller opushade commits;
  - ett GitHub-verktyg (`mcp__github__*` med `owner` och `repo`) ska gälla repots eget `origin`;
  - ett Bash-kommando ska röra repot: arbetskatalogen ligger i repot, eller kommandot nämner
    repots namn (`cd VeckansMat`, `git -C …`, en adress med namnet i). Pekar katalogen eller
    kommandot bara ut andra repon körs hooken inte, så en `git push` i ett repo provar inte ett
    annat repos tester. Pekas inget repo ut körs den;
  - SessionStart körs alltid, en gång.

  Är sessionens rot repot självt gör vakten ingenting, eftersom repots egna inställningar redan
  kör hooken. Regel 4-hooken (PostToolUse och Stop) tas inte med –
  den körs av pluginens `regel4-check`.
- Repots `permissions.deny` och `ask` läggs i användarinställningarna (`~/.claude/settings.json`)
  av samma skript, med sökvägarna förankrade i repot: `Read(./.env)` i fonder blir
  `Read(//home/user/fonder/.env)`, så en spärr gäller bara där. Regler för Bash gäller
  kommandon och följer med som de är, alltså i alla repon. `allow` följer inte med, eftersom en
  tillåtelse från ett repo inte ska gälla i ett annat; det ger bara fler frågor. Prövat
  2026-11-10: en `Read` av en spärrad fil i fonder nekades.

Skripten ligger i claude-android, så en ändring i dem följer med nästa session precis som pluginen.

    node --test scripts/test/*.test.mjs

Apparna som använder komponentbiblioteket `android-ui` hämtar det från GitHub Packages, som kräver
inloggning även för läsning. Miljön behöver därför variablerna `GPR_USER` (GitHub-användarnamnet)
och `GPR_TOKEN` (classic token med `read:packages`), som bara nya sessioner får. I CI behövs
samma token som Actions-secret `GPR_TOKEN` i appens repo, eftersom `GITHUB_TOKEN` inte når ett annat
repos Maven-paket. Se skill `android-gradle-logic`.

### Lokalt

    /plugin install android --marketplace ParTee71/claude-android

eller låt repot slå på pluginen i `.claude/settings.json`, vilket fungerar lokalt:

```json
{
  "extraKnownMarketplaces": {
    "claude-android": { "source": { "source": "github", "repo": "ParTee71/claude-android" } }
  },
  "enabledPlugins": { "android@claude-android": true }
}
```
