---
name: kotlin-flows
description: Use when working with Flow, StateFlow, SharedFlow, or Channel in Kotlin — including cold vs hot stream decisions, operator chains, lifecycle-safe collection, UI state management, callback bridging, or Channel migration in Android or KMP projects. Svenska trigger-ord: flöde, flow, StateFlow, tillstånd, UiState, kombinera, uppdateras inte, lyssnare, snapshot, realtid.
---

# Kotlin Flows

## Overview

Kotlin Flow is a cold, sequential stream built on coroutines. `StateFlow` and `SharedFlow` are hot variants. Choosing the right type, collecting safely, and never exposing mutable types are the core concerns here.

## Choosing the Right Type

| Type | Hot/Cold | Retains state | Use for |
|---|---|---|---|
| `Flow` | Cold | No | One-off streams, repository data |
| `StateFlow` | Hot | Yes (last value) | UI state, **including one-off ViewModel events** |
| `SharedFlow` | Hot | Configurable | Multi-collector broadcast where missed events are acceptable |
| `Channel(BUFFERED).receiveAsFlow()` | Hot | No (queued until consumed) | Not the default for UI events – see below |

- Representing current state that new collectors need immediately? → `StateFlow`
- One-off event from the ViewModel (navigate after save, show a message)? → a field in `UiState` that the UI consumes and acknowledges
- Broadcasting to multiple collectors? → `SharedFlow`
- Simple data stream from one source? → `Flow`

## One-Off Events Belong in UiState (Default)

Google's guidance ([UI events](https://developer.android.com/topic/architecture/ui-layer/events)):
an event that originates in the ViewModel is **reduced to UI state**. The UI reacts to the state
and tells the ViewModel when it has handled it. A `Channel` or `SharedFlow` can lose the event
between emission and collection (configuration change, background), and its order relative to
the state is not guaranteed.

```kotlin
data class EditUiState(
    val name: String = "",
    val isSaving: Boolean = false,
    val savedId: String? = null,        // navigate when non-null
    val userMessage: UserMessage? = null, // snackbar when non-null
)

class EditViewModel(/* ... */) : ViewModel() {
    private val _uiState = MutableStateFlow(EditUiState())
    val uiState: StateFlow<EditUiState> = _uiState

    fun save() = viewModelScope.launch {
        _uiState.update { it.copy(isSaving = true) }
        val id = repository.save(_uiState.value.name)
        _uiState.update { it.copy(isSaving = false, savedId = id) }
    }

    fun onNavigated() = _uiState.update { it.copy(savedId = null) }
    fun onMessageShown() = _uiState.update { it.copy(userMessage = null) }
}

@Composable
fun EditScreen(viewModel: EditViewModel, onSaved: (String) -> Unit) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()
    state.savedId?.let { id ->
        LaunchedEffect(id) { onSaved(id); viewModel.onNavigated() }
    }
}
```

UI-originated actions that need no business logic (open a dialog, scroll) stay in the UI as
plain Compose state. A repo whose shared screen frames still use `Channel(BUFFERED)` for effects
keeps that until the frames are migrated; repots CLAUDE.md says which applies.

**`Channel.receiveAsFlow()` is fan-out, not broadcast.** With multiple collectors, each event reaches one collector only. Use `SharedFlow` when all collectors must see every event.

## Key Operators

| Goal | Operator |
|---|---|
| Transform each value | `map` |
| Filter values | `filter` |
| Side effects without transformation | `onEach` — never `map` for side effects |
| Cancel previous on new emission | `flatMapLatest` — search queries, user input |
| Process all concurrently | `flatMapMerge` |
| Process sequentially in order | `flatMapConcat` |
| Debounce rapid input | `debounce(ms)` |
| Skip duplicate consecutive values | `distinctUntilChanged()` |
| Change upstream execution context | `flowOn(dispatcher)` |
| Convert cold flow to hot StateFlow | `stateIn(scope, started, initialValue)` |
| Combine latest values from multiple flows | `combine(flowA, flowB) { a, b -> }` |

### `combine` warning

`combine` waits for **every** input to emit at least once before producing its first value. If one input is a cold flow that never emits, the combined flow never emits ("screen stuck on loading"). Make every input a `StateFlow` or give cold inputs `onStart { emit(initial) }`.

## StateFlow Patterns

**Never expose `MutableStateFlow` publicly.**

```kotlin
class NewsViewModel : ViewModel() {
    private val _uiState = MutableStateFlow<NewsUiState>(NewsUiState.Loading)
    val uiState: StateFlow<NewsUiState> = _uiState

    fun refresh() {
        viewModelScope.launch {
            _uiState.update { currentState -> currentState.copy(isRefreshing = true) }
        }
    }
}
```

Use `_uiState.update { }` for thread-safe atomic updates. The lambda can be retried on CAS contention — never put side effects inside it.

### `stateIn` vs `MutableStateFlow`

- **`stateIn`** — when a repository exposes a cold `Flow` and the ViewModel wants to expose it as `StateFlow`. The flow drives the state.
- **`MutableStateFlow`** — when the ViewModel drives state imperatively: loading results, reacting to user actions, combining multiple sources.

**`stateIn` sharing strategies:**
- `SharingStarted.WhileSubscribed(5_000)` — stops when no collectors, survives config changes; use in ViewModels
- `SharingStarted.Eagerly` — starts immediately, never stops

**Never call `stateIn(scope, ...)` inside a function** — creates a fresh shared coroutine on every call. Put it at property declaration.

## Error Handling in Flows

```kotlin
// .catch — intercepts exceptions from upstream only
repository.getItems()
    .catch { e -> emit(emptyList()) }
    .collect { items -> updateUi(items) }

// .catch does NOT cover collector errors
repository.getItems()
    .catch { e -> /* does not catch exceptions thrown inside collect */ }
    .collect { items ->
        riskyOperation(items) // exception here propagates to the coroutine scope
    }
```

## Lifecycle-Safe Collection (Android)

```kotlin
// DO: collectAsStateWithLifecycle in Compose (preferred)
@Composable
fun NewsScreen(viewModel: NewsViewModel) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
}

// DO: repeatOnLifecycle in non-Compose code
lifecycleScope.launch {
    repeatOnLifecycle(Lifecycle.State.STARTED) {
        viewModel.uiState.collect { state -> updateUi(state) }
    }
}

// DO NOT: collects even when app is in background
lifecycleScope.launch {
    viewModel.uiState.collect { state -> updateUi(state) }
}
```

**Event state is consumed once.** Act on it in a `LaunchedEffect` keyed on the value and call the ViewModel's acknowledge function (`onNavigated()`), so recomposition does not repeat it.

## Callback Bridging

```kotlin
// Stream callbacks → callbackFlow
fun EditText.textChanges(): Flow<String> = callbackFlow {
    val watcher = object : TextWatcher {
        override fun afterTextChanged(s: Editable?) { trySend(s.toString()) }
        override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {}
        override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) {}
    }
    addTextChangedListener(watcher)
    awaitClose { removeTextChangedListener(watcher) } // CRITICAL — always clean up
}
```

**`awaitClose {}` is mandatory in `callbackFlow`.** Omitting it leaks the registered callback and prevents the flow from completing.

## Common Pitfalls

| Pitfall | Fix |
|---|---|
| `lifecycleScope.launch { flow.collect {} }` without `repeatOnLifecycle` | Wrap with `repeatOnLifecycle(Lifecycle.State.STARTED)` |
| Missing `awaitClose {}` in `callbackFlow` | Always add `awaitClose { unregister() }` |
| `MutableStateFlow` or `MutableSharedFlow` exposed publicly | Private mutable, public immutable |
| `_state.value = _state.value.copy(...)` in concurrent code | Use `_state.update { it.copy(...) }` |
| `SharingStarted.Eagerly` in ViewModel | Use `WhileSubscribed(5_000)` |
| Event field in `StateFlow` never cleared (re-fires on resubscription) | Acknowledge it: `onNavigated()` sets it back to `null` |
| `catch (e: Exception)` inside `collect {}` | Catches `CancellationException` — catch specific types |
| Side effects inside `combine`/`map` transforms | Move to `onEach` outside the transform |
| `Channel`/`SharedFlow` as the default for ViewModel events | Put the event in `UiState` and acknowledge it |
| Manual `Job?` cancellation + re-launch pattern | Use `flatMapLatest` |
| `stateIn(scope, ...)` inside a function | Move `stateIn` to property declaration |
| `.map` on `StateFlow` returns `Flow`, not `StateFlow` | Re-terminate with `.stateIn(...)` |
| Side effects inside `combine`/`map` → re-fires on rotation | Only pure transforms inside `combine`/`map` |

## RIGHT vs WRONG: Manual Job vs flatMapLatest

```kotlin
// WRONG — manual Job lifecycle management; error-prone, verbose
class SearchViewModel : ViewModel() {
    private var searchJob: Job? = null

    fun onQueryChanged(query: String) {
        searchJob?.cancel()
        searchJob = viewModelScope.launch {
            delay(300)
            _results.value = repository.search(query)
        }
    }
}

// RIGHT — flatMapLatest cancels previous collection automatically
class SearchViewModel : ViewModel() {
    private val query = MutableStateFlow("")

    val results = query
        .debounce(300)
        .flatMapLatest { q -> repository.searchFlow(q) }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    fun onQueryChanged(q: String) { query.value = q }
}
```

## In the repo

The repo's own flows (auth state, collections, settings, sync indicator) and its shared
list-state conversion are described in repots CLAUDE.md and the repo's data-layer skill.
