---
name: android-dev
description: Baslinje för allt Android/Kotlin-arbete — arkitektur (MVVM, StateFlow<UiState>, Hilt, repository), plattformskrav (targetSdk, Material 3-versioner, Baseline Profile, ktlint, beroendeuppdateringar), att granska befintliga mönster först och att repots egna regler går före. Ladda alltid vid kod i en Android-app, tillsammans med mer specifika skills. Trigger-ord: Android, Kotlin, ViewModel, Hilt, Compose, Gradle, Firestore, Room, DataStore, targetSdk, Play, Baseline Profile, ktlint, Spotless, Renovate, Dependabot.
---

# Senior Android Development Skills

You are a senior Android engineer. Apply the following guidelines to all Android work.
**Repots CLAUDE.md och repots egna skills går före allt generellt här.**

## Architecture

- Use clean architecture with repository pattern for data persistence.
- **MVVM** with `StateFlow<UiState>` and sealed events (`vm.onEvent(...)`) unless repots CLAUDE.md says otherwise – do not switch a repo to MVI on your own.
- Use Compose for all new UI. For legacy interop use `AndroidView` / `ComposeView`.
- Use `collectAsStateWithLifecycle` to observe state from ViewModels in composables.
- Use `StateFlow` / `State` to manage UI state.
- Use Material 3 for the UI (Material 3 Expressive where the repo has adopted it, via repots `ui/theme`).
- Use Hilt for DI with KSP.
- Use `kotlinx.serialization` for serialization.
- Storage and network stack (Firestore, Room, DataStore, Retrofit/OkHttp) are the repo's choice – se repots CLAUDE.md. Whatever it is, one generic access layer maps platform errors once; feature code never talks to the SDK directly.
- Pure domain logic (models, codecs, calculations) belongs in a JVM module or package without Android dependencies when the repo has one.

## Platform requirements

- **targetSdk 36.** Google Play requires target API 36 for app updates from **2026-08-31**. Bump `targetSdk` and `compileSdk` together, read the behaviour changes for API 36 (edge-to-edge is enforced, predictive back, adaptive layouts on large screens ignore orientation/resizability locks) and cover them with tests before release.
- **Material 3 on beta or stable, never alpha.** Compose Material 3 (including the Expressive APIs) is pinned to a beta or stable release in the version catalog. An alpha is only taken for a specific API the repo needs, with the reason and the user's ok in the PR.
- **Baseline Profile.** Release builds ship a Baseline Profile (`androidx.baselineprofile` plugin + a `:baselineprofile` macrobenchmark module covering start and the main scrolls). It is generated in the release flow or on demand, never in every PR (CI budget).
- **ktlint via Spotless with compose-rules.** Formatting and lint for Kotlin run through Spotless (`com.diffplug.spotless`) with ktlint and the `io.nlopez.compose.rules` ktlint rules, `.editorconfig` in the repo root. `spotlessCheck` is a fast check; `spotlessApply` fixes. Where the check runs in CI follows the repo's CI budget.
- **Automated dependency updates.** Renovate or Dependabot opens PRs for the version catalog and GitHub Actions, grouped (e.g. AndroidX, Kotlin + KSP + Compose compiler, Firebase BoM) and scheduled weekly, so updates don't each cost a CI run. Which one the repo uses – se repots CLAUDE.md.

## Gemensamt komponentbibliotek: android-ui

ReseApoteket och Dagboken hämtar tema-API och delade komponenter från biblioteket
**ParTee71/android-ui** (`se.partee71.ui:ui-theme`, `se.partee71.ui:ui-components`, senare
`ui-common`) via GitHub Packages. Vilka delar en app redan hämtar därifrån och vilken version
står i appens versionskatalog och skill `shared-ui-components`.

- **Sök i biblioteket först.** Innan en komponent, ett tema-värde eller en ram byggs eller ändras
  i appen: finns den i android-ui (`se.partee71.ui.*`), använd den.
- **En variant blir en parameter i biblioteket, aldrig en lokal kopia** (regel 4). Parametern får
  en default som bevarar dagens utseende i båda apparna, med test och skärmdump i biblioteket.
- **Ändra en delad komponent i biblioteket, inte i appen.** Flödet är: PR i android-ui med höjd
  version → tagg `v<version>` publicerar → en PR per app som höjer versionen i katalogen, en PR i
  taget (skill `implement-issue`, steg 4).
- **Färger, typsnitt och apptoner stannar i appen.** Appen fyller i `AppTheme(…)`; biblioteket
  har bara strukturen (`ExtendedColors`, `AppShapes`, `AppTypography`, `Spacing`, `Tone.Primary`).
- fonder använder inte biblioteket (eget tema).

## Existing-pattern check (before designing new mechanisms)

Before adding any new mechanism — events, flows, navigation triggers, or state shape — in an existing project, check how the surrounding code already handles it.

### Audit procedure

Open a sibling ViewModel in the same feature module — or `Grep` the feature for the terms below — **before writing any new code**:

| Concern | What to look for |
|---|---|
| How actions reach the ViewModel | Sealed `Event` / `Intent` / `Action` interface, `onEvent()` dispatcher, and a Handler interface |
| How one-off events reach the UI | Event fields in `UiState` that the UI acknowledges, or an older `Channel` / `SharedFlow` of effects |
| How navigation is triggered | Nav callbacks, `NavDisplay` (Nav 3) use, or navigation events in state |
| How the ViewModel exposes new behaviour | Event class entries + handler methods, or direct `fun` |
| How state is structured | `UiState` sealed classes, `StateFlow<State>` shape, field granularity |

### Red flags

- **Adding a public `fun foo()` on the ViewModel** when the project has a sealed `Event` + `onEvent()` pattern → add an Event data object and a handler method instead.
- **Creating a new `SharedFlow` or `Channel` for UI events** → put the event in `UiState` instead (skill `kotlin-flows`); if the repo's frames still use an effects channel, follow repots CLAUDE.md.
- **New composable parameter that bypasses existing state/event wiring** → look at how sibling screens wire the same ViewModel.

### Rule

**If the project has an established pattern for X, use it — even if a simpler direct approach would also work.** Simplicity is not a valid reason to diverge from the architecture.

## State and Events

### Where state lives

| Scope | Owner | When |
|---|---|---|
| Single composable | `remember { mutableStateOf(...) }` | Transient UI state that resets on screen leave |
| Single composable, survives rotation | `rememberSaveable { mutableStateOf(...) }` | UI-local state that needs to outlive config change |
| Survives recomposition AND config change | `ViewModel` exposing `StateFlow<UiState>` | App state — anything the user can return to |
| Survives process death | `ViewModel.savedStateHandle` or persistence layer | User-input drafts |

### One-off events

ViewModel events (show a message, navigate after save) are **state**: a field in `UiState` that
the UI acts on and then acknowledges with an event back to the ViewModel, which clears it
([developer.android.com/topic/architecture/ui-layer/events](https://developer.android.com/topic/architecture/ui-layer/events)).
Details and example in skill `kotlin-flows`. `Channel`/`SharedFlow` is not the default.

### State updates

`private val _state = MutableStateFlow(...)`, `val state = _state.asStateFlow()`, and change it
with `_state.update { it.copy(...) }` – atomic, unlike `_state.value = _state.value.copy(...)`.

## Compose

- Hoist state to the lowest common ancestor — composables receive state and emit events upward.
- Screen-level composables connect to the ViewModel; child composables are stateless.
- For Compose specifics (stability, `remember`, Modifiers, side effects, lists), defer to the `compose-expert` skill.

## Async & Concurrency

- Use Kotlin Coroutines and Flow for all async work. No `LiveData` in new code.
- `viewModelScope` for ViewModel coroutines. Code that picks a dispatcher gets it injected; `Dispatchers.` is named only in `di/` (skill `kotlin-coroutines`). Main-safe APIs (Firestore, Room's suspend DAOs, DataStore) need no dispatcher switch.
- Expose `StateFlow` for UI state, `Flow` for streams, suspend functions for one-shot calls.
- Defer to `kotlin-coroutines` and `kotlin-flows` skills for operator-level details.

## Gradle

- Use version catalogs (`libs.versions.toml`) and Kotlin script (`.kts`) for all Gradle files.
- The Java target (17 or 21, toolchain or not) is the repo's and must match CI – se repots CLAUDE.md. Shared build settings live in one place (skill `android-gradle-logic`).
- Keep ProGuard/R8 rules updated when adding libraries.

## Specialskills (Googles)

Oförändrade kopior av Googles skills för smala frågor. Repots regler går före.

| Fråga | Skill |
|---|---|
| Behörigheter i manifestet, runtime-förfrågningar, IPC-skydd | `android-permissions-security` |
| Exporterade komponenter, inkommande Intents | `android-intent-security` |
| Skriva eller härda `firestore.rules` | `firestore-rules-creation` |
| Granska `firestore.rules` | `firebase-security-rules-auditor` |
| Keep-regler och R8 (releasebygget) | `r8-analyzer` |
| ANR-risker, stackdumpar | `anr-audit-and-fix` |
| Play-policyn inför publicering | `play-policy-insights` |
| Rekomposition och tappade bildrutor | `jetpack-compose-performance` |

## Package Structure

The package tree is the repo's – se repots CLAUDE.md / architecture doc. General rule: look and
shared behaviour live only in `ui/theme`, `ui/components` and `ui/common`; storage only in the
data layer's access package; errors are mapped once; Hilt modules in `di/`.

## Data Flow

Compose → ViewModel → Repository → Data sources

- Repository lives in the `data` layer.
- ViewModel lives in the `ui/<feature>` layer.
- Data models are mapped to UI models inside ViewModels.
- UI models contain only what the screen needs to display.

## Error Handling

- Model success/error with sealed classes/interfaces (`Result<T>`).
- UI state must explicitly represent loading, success, and error.
- Never swallow exceptions silently in repositories or data sources.

**Error propagation by layer:**

1. **Platform APIs and data sources** (Firestore, Room, Credential Manager, Firebase Auth, network) throw their own exceptions.
2. **The single access point maps them once** to the repo's domain error type. Repositories built on it do **not** catch or remap again – they pass `Result<T>` through. Never let raw data-layer exceptions leak past this boundary.
3. **ViewModels** handle `Result<T>` and put the error in UI state; screens show it through the repo's one shared message mapping. Cancellation is silent.

## Navigation

- **Navigation 3**: one `@Serializable` key implementing `NavKey` per screen; arguments live in the key, never in string routes. Navigation 2 (`navigation-compose`/`NavController`) is not used in new code.
- One back stack per tab, saved across rotation and process death. Screens navigate through callbacks wired where the entries are provided — never from the ViewModel.
- Screen transitions are defined once.
- ViewModels are scoped per entry (`lifecycle-viewmodel-navigation3`). A ViewModel that needs a navigation argument takes it with assisted injection — `@HiltViewModel(assistedFactory = …)` + `hiltViewModel<VM, VM.Factory> { it.create(id) }` (`androidx.hilt.lifecycle.viewmodel.compose`) — not from `SavedStateHandle`.
- Single Activity host. Recipes: skill `navigation-3`.

## Background Work

- Use **WorkManager** for deferrable background tasks that must survive process death (sync, upload, periodic jobs). Exact-time reminders use AlarmManager.
- Use `CoroutineWorker` for suspend-friendly workers.
- Constrain work with `Constraints` (network, charging) rather than implementing retry logic manually.
- With Hilt: use `@HiltWorker` + `@AssistedInject`. App must implement `Configuration.Provider` with injected `HiltWorkerFactory`. AndroidManifest must disable default `WorkManagerInitializer`.

## Adaptability

- Always respect the project's established architecture and conventions first.
- If existing code contradicts these guidelines, flag the inconsistency and ask how to proceed — never silently override.
