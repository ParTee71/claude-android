# claude-android

Gemensam Claude Code-plugin för ReseApoteket, Dagboken och fonder. Här ligger det som
är generellt för de tre Android-repona: Kotlin, Compose, Navigation 3 och arbetssättet
kring issues och PR:er. Det som är eget för ett repo stannar i repots `.claude/`, och där
de krockar gäller repots CLAUDE.md.

## Skills

Skillsen anropas som `android:<namn>`.

| Skill | När |
|---|---|
| `android-dev` | Baslinje för allt Android/Kotlin-arbete, med plattformskraven (targetSdk 36, Material 3 beta/stabil, Baseline Profile, ktlint via Spotless, Renovate/Dependabot). |
| `compose-expert` | Compose: state, stabilitet (`@Immutable` UiState med listor), `key`/`contentType` i listor. |
| `kotlin-coroutines` | Coroutines; dispatchers injiceras, `Dispatchers.` bara i `di/`. |
| `kotlin-flows` | Flows; engångshändelser i UiState som UI:t kvitterar. |
| `accessibility-compose` | TalkBack, tryckytor, stor text, färg och diagram. |
| `android-gradle-logic` | Versionskatalog, delad byggkonfiguration, convention plugins. |
| `firebase-auth` | Google-inloggning med Credential Manager + Firebase Auth. |
| `mockup` | Mockup före ny GUI. |
| `refine-issue` | Idé eller bugg till ett förfinat issue med Definition of Done och **Agent · modell · effort**. |
| `implement-issue` | Issue till mergad PR: en PR i taget, mockup-grind, tester, versionshöjning, granskare + `/code-review` i rundor. |
| `release` | Versionshöjningen i funktions-PR:en och releasen via `workflow_dispatch`, utan fråga om versionsnumret. |
| `navigation-3` | *Googles.* Navigation 3: djuplänkar, flera stackar, scener. |
| `android-intent-security` | *Googles.* Exporterade komponenter och Intents. |
| `firebase-security-rules-auditor` | *Googles.* Granska `firestore.rules`. |

Googles skills är oförändrade kopior med källa och licens i sina `SOURCE.md`.

Arbetsflödesskillsen (`refine-issue`, `implement-issue`, `release`) beskriver processen. Repodetaljerna
– owner/repo, agenter, datakedjan, etiketter, versionsfil, release-workflow och dess inputs – står i
repots skill `android-projekt` under avsnitten **Issues**, **Arbetsflöde** och **Release**, och
skillsen hänvisar till repots egna `ci-budget`, `testing-strategy`, `requirements-kravlista`,
`data-safety-backup`, `shared-ui-components` och `ui-style`.

## Hook

`hooks/regel4-dispatch.mjs` kör regel 4-kontrollen (PostToolUse efter Edit/Write, Stop före turens
slut) när sessionens projektrot är en gemensam katalog med flera repon under sig, som i molnsessioner
med `/home/user`. Då laddas inget repos `.claude/settings.json`. Pluginen har inga egna mönster: den
lämnar varje händelse till repots egen `.claude/hooks/regel4-check.mjs`. Det skriptet och dess
mönsterfiler stannar i repot, eftersom repots CI-hooktest och `UiConsistencyTest` läser dem och CI inte
når den privata pluginen. Är projektroten själv ett repo med egen hook gör pluginen ingenting.

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
} >> /tmp/plugin-setup.log 2>&1 || true
```

`|| true` är nödvändigt: ett setup-skript som felar stoppar alla nya sessioner. Gick något fel
står det i `/tmp/plugin-setup.log`.

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
