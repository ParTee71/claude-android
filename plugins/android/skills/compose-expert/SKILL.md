---
name: compose-expert
description: >
  Jetpack Compose-expert för Android-UI (Material 3 / Material 3 Expressive, Navigation 3).
  Använd när användaren nämner Compose-API:er (@Composable, remember, LaunchedEffect,
  MaterialTheme, LazyColumn, Modifier, recomposition, @Stable, @Immutable, NavDisplay, NavKey,
  MotionScheme, animation) eller skriver på svenska om skärm, vy, composable, rekomposition,
  animation, rörelse, navigering, skärmbyte, prestanda i UI eller "skärmen laggar". Laddas
  tillsammans med android-dev; repots egna regler för komponenter och designspråk (se repots
  CLAUDE.md) går före generella Compose-råd.
---

## When this skill applies

### Compose API mentions
`@Composable`, `remember`, `mutableStateOf`, `derivedStateOf`, `rememberSaveable`,
`LaunchedEffect`, `DisposableEffect`, `SideEffect`, `rememberCoroutineScope`,
`Scaffold`, `NavDisplay`, `NavKey`, `MaterialTheme`, `MotionScheme`, `ColorScheme`,
`Typography`, `LazyColumn`, `LazyRow`, `LazyVerticalGrid`, `HorizontalPager`,
`Modifier`, `Modifier.Node`, `recomposition`, `@Stable`, `@Immutable`, `CompositionLocal`.

### Design system / design-to-code
`atomic design`, `design tokens`, `design system`, `component library`, `reusable component`,
`Figma to Compose`, `design to compose`, `build this UI`, `implement this design`.

### Casual phrasing
"my compose screen is slow", "my recomposition is broken",
"how do I pass data between screens", "Android UI", "Kotlin UI",
"compose layout", "compose navigation", "compose animation".

## Routing

| Fråga gäller | Gå till |
|---|---|
| Vilken komponent/ram ska användas, förbjudna M3-anrop, variant av en komponent | repots skill för delade komponenter (se repots CLAUDE.md) – går före allt nedan |
| Färger, typografi, former, rörelse, texter | repots skill för designspråket (se repots CLAUDE.md) |
| Ny skärm eller ändrat utseende | `mockup` |
| TalkBack, tryckytor, stor text | `accessibility-compose` |
| StateFlow, `stateIn`, `combine`, engångshändelser | `kotlin-flows` |
| Coroutines i ViewModel, avbrytning, dispatchers | `kotlin-coroutines` |
| Skärmdumpar, Robolectric, kontraktstester | repots teststrategi (se repots CLAUDE.md) |
| Navigation 3: djuplänkar, flera stackar, scener, villkorad navigering (Googles referens; repots egen back stack och övergångar går före) | `navigation-3` |

Allt annat (state, side effects, prestanda, listor, modifiers, animation) besvaras med
principerna nedan.

## Workflow

When helping with Compose code:

### 1. Understand the request
- What Compose layer is involved? (Runtime, UI, Foundation, Material3, Navigation)
- Is this a state problem, layout problem, performance problem, or architecture question?

### 2. Analyze the design (if visual reference provided)
- If the user shares a mockup (Design canvas), screenshot, or design spec, decompose it into the repo's shared frames + catalog components
- Map the design to the repo's theme tokens and component catalog; an element that is missing there becomes a new shared component, never a local one
- Identify animation needs

### 3. Apply and verify
- Write code that follows established patterns
- Flag anti-patterns in existing code
- Suggest the minimal correct solution — don't over-engineer

## Key Principles

1. **Compose thinks in three phases**: Composition → Layout → Drawing. State reads in each phase only trigger work for that phase and later ones.

2. **Recomposition is frequent and cheap** — but only if you help the compiler skip unchanged scopes. Use stable types, avoid allocations in composable bodies.

3. **Modifier order matters**. `Modifier.padding(16.dp).background(Color.Red)` is visually different from `Modifier.background(Color.Red).padding(16.dp)`.

4. **State should live as low as possible** and be hoisted only as high as needed. Don't put everything in a ViewModel just because you can.

5. **Side effects exist to bridge Compose's declarative world with imperative APIs**. Use the right one for the job — misusing them causes bugs that are hard to trace.

## Stability: UiState with lists

`List<T>` is an interface, so the Compose compiler treats it as unstable: a `UiState` holding a
plain `List` can't be proven unchanged, and every emission recomposes everything that reads it.
That bites hardest with Firestore or Room, whose mappers build a new list on every snapshot even
when the content is equal.

Make every `UiState` that carries a collection stable:

```kotlin
@Immutable
data class ListUiState<T>(
    val items: ImmutableList<T> = persistentListOf(),   // kotlinx.collections.immutable
    val loading: Boolean = false,
)

// in the ViewModel / mapper
items = docs.map(codec::decode).toImmutableList()
```

- **`@Immutable`** when every property is read-only and never changes after construction (data classes of `val`s, immutable collections).
- **`@Stable`** when the type is mutable but notifies Compose of changes (holds `MutableState`, e.g. an editor state class).
- Prefer `ImmutableList`/`PersistentList` from `kotlinx-collections-immutable` over annotating a class that holds a plain `List` — the annotation is a promise the compiler can't check.
- Strong skipping (default since Kotlin 2.0.20) compares unstable params by instance, so a new list per snapshot still recomposes; stable, equal-comparable types are still needed.
- Check with the Compose compiler reports (`composeCompiler { reportsDestination = … }`) when a screen recomposes too often.

## Lazy lists: key and contentType

Always give `items` a stable `key` and, when rows differ in kind, a `contentType`:

```kotlin
LazyColumn {
    items(
        items = state.rows,
        key = { it.id },                       // stable across reorders and inserts
        contentType = { it::class },           // or an enum: Header, Entry, Footer
    ) { row ->
        when (row) {
            is Row.Header -> SectionHeader(row.title)
            is Row.Entry -> EntryRow(row)
        }
    }
}
```

- `key` keeps scroll position, `remember` state and animations attached to the right item.
- `contentType` lets Compose reuse compositions only between items of the same kind, which cuts work when scrolling a mixed list.
- Never use the index as key, and never build a key that changes when the item's content changes.

## Patterns

Repots exakta mönster (tema, ramar, komponenter, navigering) står i repots CLAUDE.md och skills;
de generella reglerna är:

- **Material 3 (Expressive)** via repots `ui/theme`: inga färger, former, textstilar eller hörn/höjd-dp i feature-kod.
- **Navigation 3**: `@Serializable` `NavKey`, back stack per flik, `NavDisplay` + `entryProvider`, övergångar definierade en gång. Ingen `NavHost`/`NavController`.
- **MVVM** med `StateFlow<UiState>` + `collectAsStateWithLifecycle()` och sealed events (`vm.onEvent(...)`).
- **Hilt**: `hiltViewModel()` på skärmnivå; ViewModel-scope per nav-post via `lifecycle-viewmodel-navigation3`.

> Expressive- och Nav3-API:er är nya. Använd bara namn och signaturer som repot verifierat
> (se repots CLAUDE.md); gissa aldrig ett API-namn.

### Skärmstruktur
En funktionsskärm är en `@Composable fun XScreen(vm: XViewModel = hiltViewModel())` som samlar
state och skickar det till en delad ram:
```kotlin
@Composable
fun ItemsScreen(vm: ItemsViewModel = hiltViewModel(), onOpen: (String) -> Unit) {
    val state by vm.state.collectAsStateWithLifecycle()
    EntityListScreen(                                    // repots delade listram
        title = stringResource(R.string.items_title),
        state = state.list,                              // ListUiState<Item>
        row = { item -> ItemRow(item, onClick = { onOpen(item.id) }) },
        onAdd = { vm.onEvent(ItemsEvent.Add) },
    )
}
```
Barn-composables tar typat state och callbacks – aldrig ViewModel. Laddning, tomt läge, fel,
lägg till och ångra hanteras av ramen, inte av skärmen.

### Fel, laddning, knappar och kort
Hanteras av repots delade delar (felmappning i snackbar, laddningsindikator, knapp med
`loading`, kort + sektionsrubrik). Skriv aldrig egen `CircularProgressIndicator` i en knapp,
egen feltext med `colorScheme.error` eller `Card` + `HorizontalDivider` med egen padding.

## Anti-Patterns to Avoid

- Never call `remember` inside conditional blocks or loops
- Never read `StateFlow.value` in a composable — always use `collectAsStateWithLifecycle()`
- Never put a plain `List`/`Map` in a `UiState` — use immutable collections and `@Immutable`
- Never use `items(list)` without `key` in a list that can change
- Never pass `Context` to a ViewModel constructor — use `@ApplicationContext` or `activityContext` passed from the composable for operations that need it
- Never mutate the Navigation 3 back stack from a ViewModel — use callbacks or effects
- `LaunchedEffect(Unit)` for one-time setup; `LaunchedEffect(key)` when the effect should re-run on key change
- `DisposableEffect` for resources that need cleanup (listeners, subscriptions)
- Use `rememberLauncherForActivityResult` for Activity Result API — never call `startActivityForResult` directly
