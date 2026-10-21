# claude-android

Gemensam Claude Code-plugin för ReseApoteket, Dagboken och fonder. Här ligger det som
är generellt för de tre Android-repona: Kotlin, Compose, Navigation 3 och arbetssättet
kring issues och PR:er. Det som är eget för ett repo stannar i repots `.claude/`, och där
de krockar gäller repots CLAUDE.md.

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
| `refine-issue` | Idé eller bugg till ett förfinat issue med Definition of Done och **Agent · modell · effort**. |
| `implement-issue` | Issue till mergad PR: en PR i taget, mockup-grind, tester, versionshöjning, granskare + `/code-review` i rundor. |
| `release` | Versionshöjningen i funktions-PR:en och releasen via `workflow_dispatch`, utan fråga om versionsnumret. |
| `testing-strategy` | Regel 2 generellt: tester på varje berörd nivå, flaky är en bugg, skärmdumpar, mönster och fallgropar. Repots `testing-strategy` har nivåtabellen, hjälparna och kommandona. |
| `ci-budget` | Regel 5 generellt: ~8 minuter per PR, `changes` + `ci-ok`, emulatorn bara när koden rörs, lint och R8 utanför PR-flödet. Repots `ci-budget` har tabellen över vad som körs när. |
| `navigation-3` | *Googles.* Navigation 3: djuplänkar, flera stackar, scener. |
| `android-intent-security` | *Googles.* Exporterade komponenter och Intents. |
| `firebase-security-rules-auditor` | *Googles.* Granska `firestore.rules`. |

Googles skills är oförändrade kopior med källa och licens i sina `SOURCE.md`.

Arbetsflödesskillsen (`refine-issue`, `implement-issue`, `release`) beskriver processen. Repodetaljerna
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
| `granskare` | Före varje PR (`implement-issue` steg 8): diffen mot de fem reglerna och mockup-regeln, rapport i en tabell. Sessionens modell. | `CLAUDE.md` och `android-projekt` → **Granskning** |
| `ci-doktor` | Vid rött CI: loggar, skärmdumpsdiffar och CPD-rapporter, föreslår fix utan att pusha. Sonnet. | `ci-budget` → **Felklasser** |
| `testskrivare` | Tester på tre eller fler nivåer, fixturer. Sonnet. | `testing-strategy` → **För testskrivaren** |

Agenter som är för olika mellan repona (`arkitekt`, `byggare`, `db-inspektor`) stannar i repots
`.claude/agents/`. Repona med dokumentkontrollen `check-links.mjs` listar pluginens skills i
`.github/scripts/plugin-skills.txt` och agenter i `plugin-agents.txt`, eftersom CI inte når
pluginen – uppdatera dem när pluginen får eller tappar en skill eller agent.

## Hook

`hooks/regel4-dispatch.mjs` kör regel 4-kontrollen (PostToolUse efter Edit/Write, Stop före turens
slut) när sessionens projektrot är en gemensam katalog med flera repon under sig, som i molnsessioner
med `/home/user`. Då laddas inget repos `.claude/settings.json`. Pluginen har inga egna mönster: den
lämnar varje händelse till repots egen `.claude/hooks/regel4-check.mjs`. Det skriptet och dess
mönsterfiler stannar i repot, eftersom repots CI-hooktest och `UiConsistencyTest` läser dem och CI inte
når den privata pluginen. Är projektroten själv ett repo med egen hook gör pluginen ingenting.

`hooks/ktlint-check.mjs` kör repots Spotless (ktlint + compose-rules) på varje ändrad `.kt`/`.kts`-fil
(PostToolUse), i alla repon vars root-`build.gradle.kts` använder Spotless. Den går via Spotless
IDE-hook (`-PspotlessIdeHook`), så filen skrivs aldrig om och reglerna läses från repots egen
`ktlintRules`. Regelbrott som `spotlessApply` inte kan rätta, till exempel `lambda-param-in-effect`
och `content-slot-reused`, blockerar med regel och rad. Ren formatering lämnas åt `spotlessApply`.
Med varm Gradle-daemon tar det 1–3 sekunder. Hinner den inte inom 25 sekunder (kall daemon, första
ändringen i sessionen) blir det en påminnelse om `spotlessCheck` i stället. Spotless körs inte i CI
(CI-budgeten), så hooken är det som fångar brotten innan push.

Varje besked från de två hookarna (en regel 4-träff, en Stop-blockering per repo, ett ktlint-brott
eller en påminnelse) skriver en rad till `/tmp/claude-hooks.log` (eller `$CLAUDE_HOOKS_LOG`): tid,
hook, regel och repo, tabbseparerade. Filinnehåll och kod skrivs aldrig, och en logg som inte går att
skriva stoppar aldrig hooken. Veckomätningen läser filen, eftersom PostToolUse-beskeden inte syns i
sessionens händelseström.

    node --test plugins/android/hooks/test/*.test.mjs

## Installation

### I molnsessioner (claude.ai/code)

Molnsessioner installerar **aldrig** ett repos `enabledPlugins`, och setup-steget når inte
privata repon över https. Pluginen installeras därför av miljöns setup-skript från den lokala
klonen – repot ska ligga i projektets repolista så att det klonas till `/home/user/claude-android`:

```bash
{
  claude plugin marketplace add /home/user/claude-android &&
  claude plugin install android@claude-android
  node /home/user/claude-android/scripts/repo-plugins.mjs /home/user
} >> /tmp/plugin-setup.log 2>&1 || true
```

`|| true` är nödvändigt: ett setup-skript som felar stoppar alla nya sessioner. Gick något fel
står det i `/tmp/plugin-setup.log`.

#### Repons egna skills, agenter och hookar i projekttrådar

En projekttråd startar i `/home/user`, ovanför alla repon, och då laddas inget repos `.claude/`.
Sista raden i blocket ovan kör `scripts/repo-plugins.mjs`, som gör varje repo under `/home/user`
med en `.claude/` till en lokal plugin i marknadsplatsen `repon` (`/home/user/.repo-plugins`).
Repona ändras inte.

- Skillsen och agenterna heter `<repo>:<namn>` i gemener, till exempel `reseapoteket:ui-style`,
  `husjakt:granska` och agenten `husjakt:granskare`. Startar sessionen inne i ett repo heter de
  `<namn>` som vanligt (och syns även med prefix, vilket inte stör).
- `skills/`, `agents/` och `commands/` är symlänkar till repots kataloger, så en ändring i repot
  slår igenom i nästa session utan något annat steg.
- Hookarna i repots `.claude/settings.json` körs via `scripts/repo-hook.mjs` med repot som
  `CLAUDE_PROJECT_DIR`, men bara när händelsen rör repot: en ändrad fil i repot, eller (vid Stop)
  ocommittade filer eller opushade commits i det. Är sessionens rot repot självt gör vakten
  ingenting, eftersom repots egna inställningar redan kör hooken. Regel 4-hooken tas inte med –
  den körs av pluginens `regel4-dispatch`.
- Repots `permissions` laddas inte; de gäller bara när sessionen startar i repot.

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
