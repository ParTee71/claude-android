---
name: firebase-auth
description: Use when working with Firebase Authentication, Google Sign-In via Credential Manager, FirebaseUser, auth state, sign-out/credential clearing or google-services.json. Covers the CredentialManager + GetSignInWithGoogleOption pattern (replaces deprecated GoogleSignIn), a sign-in gate, the per-user bootstrap and work that should only run signed in. Svenska trigger-ord: inloggning, logga in, logga ut, konto, Google-konto, användare, uid, auth, Credential Manager, AuthRepository, AuthUser, SignInScreen, google-services.json, default_web_client_id, SHA-1.
---

# Firebase Auth — Credential Manager Pattern

Use **Firebase Auth + Android Credential Manager**, never the deprecated `GoogleSignIn` API.

Whether the app **requires** sign-in (a gate before any data, Firestore rules on
`request.auth.uid`) or treats it as **optional** (e.g. only for a cloud backup) is the repo's
decision – se repots CLAUDE.md. The patterns below hold for both.

## Architecture

```
Screen (LocalContext.current = the Activity context)
  → ViewModel.onEvent(AuthEvent.SignIn(activityContext))
    → AuthRepository.signInWithGoogle(activityContext): Result<AuthUser>
      → CredentialManager.getCredential()       — Google account picker
      → GoogleIdTokenCredential.createFrom()    — ID token
      → FirebaseAuth.signInWithCredential()     — Firebase session
  authState emits the user
    → (required sign-in) bootstrap use case makes sure the user's root document exists
```

Signed-in state is **never** read from the sign-in result, always from `AuthRepository.authState`.

## The contract (`data/auth/`)

```kotlin
data class AuthUser(val uid: String, val name: String?, val email: String?, val photoUrl: String? = null)

interface AuthRepository {
    val authState: Flow<AuthUser?>                                            // null = signed out
    suspend fun signInWithGoogle(activityContext: Context): Result<AuthUser> // Activity context for the picker
    suspend fun signOut(): Result<Unit>
}
```

One implementation wraps Firebase (bound in a Hilt module in `di/`); tests use a fake.

## Rules learned the hard way

1. **`AuthUser`, never `FirebaseUser`.** The interface hands out the app's own type. If Firebase's
   type leaks into ViewModel or UI, neither can be tested without Firebase on the classpath.
2. **`GetSignInWithGoogleOption`, not `GetGoogleIdOption`.** The former opens the full-page
   account picker. The latter shows a bottom sheet and fails with "Failed to retrieve an ID
   token" when no credential is cached — exactly on the first sign-in.
3. **A cancelled account picker is not an error.** Map it to a silent cancellation; it never
   reaches the UI. Other errors are shown once and acknowledged (one-off event in `UiState`,
   skill `kotlin-flows`).
4. **`authState` seeds its first value before the listener is registered.** A flow that only
   emits on change freezes every `combine` it is part of until auth answers — the whole screen
   stays on its initial value.
5. **Sign-out clears Credential Manager's state as well as the Firebase session.** Call
   `CredentialManager.clearCredentialState(ClearCredentialStateRequest())` first, then
   `FirebaseAuth.signOut()`; without it the next sign-in silently returns the same account and
   looks like sign-out didn't work.
6. **The user's name, email and photo live in memory only.** Never stored, logged or disk-cached
   (load the photo with the disk cache disabled). Log only exception classes, never email or uid.

## Sign-in flow with a required gate

- The root composable shows a gate from `AuthViewModel.state`: `Loading | SignedOut | NeedsUser | UpdateRequired | Ready`.
- One button, one event. Signed out → sign in. Signed in but the user's root document is not yet
  on the server (bootstrap failed, e.g. offline) → `NeedsUser`, and the same button retries the
  bootstrap without a new sign-in.
- The bootstrap talks to the **server** only and is atomic: an existing document (another
  device, migrated data) is never overwritten; an empty cache never means "no user". Offline →
  nothing is created.
- `Loading` until the user's `schemaVersion` is known, so the app is never shown before
  "Uppdatera appen" could apply; `UpdateRequired` when it is newer than the app.
- The session object holding the current uid follows `authState` to `null`, so collections show
  nothing and the next account never sees the previous one's data.

## Sign-out

One use case is the only sign-out path (behind the repo's `ConfirmDialog`); UI never calls
`AuthRepository.signOut()` directly. With Firestore offline persistence:

1. Wait briefly for pending writes (`waitForPendingWrites` with a timeout) — writes not yet on
   the server live only in the cache, and after sign-out the server rejects them.
2. `AuthRepository.signOut()` — Credential Manager state and the Firebase session.
3. Only if step 1 confirmed everything synced: `terminate()` + `clearPersistence()` and a fresh
   instance on next use, so the next account starts with an empty cache. Unsynced writes keep
   the cache (no data loss); Firestore syncs them when the same account signs in again.

## Work that should only happen signed in

Workers and receivers check the user and **skip silently** — signed out is a state the app must
tolerate, not a failure:

```kotlin
if (authRepository.authState.first() == null) return Result.success()
```

## Sign-in carries no data

The Firebase session belongs to the device, not to the user's data. It is never part of the
app's export/backup, and Auto Backup rules (`backup_rules.xml`, `data_extraction_rules.xml`)
are **include** lists naming only the app's own files, so the session is never backed up. Don't
add an `<include>` for the whole files directory.

## google-services.json

For Google Sign-In, `app/google-services.json` must contain:
- one `client_type: 1` Android OAuth client **per registered SHA-1** (debug and release). Missing
  the release key's SHA-1 → sign-in works in debug but not in a signed APK.
- one `client_type: 3` Web OAuth client — generates `R.string.default_web_client_id`.

Whether the file is checked in (client config, not a secret) or written from a CI secret, the
Firebase project and the registered fingerprints – se repots CLAUDE.md. When the file is missing
a debug-only stub resource keeps the build compiling (skill `android-gradle-logic`).

If `client_type: 1` is missing:
1. Firebase Console → Project Settings → your Android app
2. Add the SHA-1 fingerprint (must not be registered in any other Google Cloud project)
3. Download the new `google-services.json` → replace `app/google-services.json`
4. Rebuild

## Error categories

The repository maps every exception once, to the repo's error type (with the same helper the
data layer uses):

| Exception | Meaning | Handle |
|---|---|---|
| `GetCredentialCancellationException` | User dismissed the picker | Cancelled — silent |
| `NoCredentialException` | No Google account on the device, or Play services missing | Show "Lägg till ett Google-konto…" |
| other `GetCredentialException` | Credential API not available | Show error |
| `FirebaseAuthException` | Firebase rejected the token | Show error; log only the exception class |
| `FirebaseNetworkException`, `IOException` | No network | Offline |

An unexpected exception falls back to a generic failure in the ViewModel — test it, so a
surprise never leaves a button spinning.

## Tests

Fake `AuthRepository`; the Firebase implementation is plumbing that can't run without Play
services and is not unit tested. Cover at the seam: successful sign-in, cancelled picker,
no credential, other failure, failure without cause, acknowledgement, sign-out (with and without
pending writes) and double-tap guard. UI tests render the screen with a handwritten `UiState`,
never a real sign-in.

## Dependencies

```toml
# libs.versions.toml
firebase-auth = { group = "com.google.firebase", name = "firebase-auth" }  # version from Firebase BOM
credentials = { group = "androidx.credentials", name = "credentials", version.ref = "credentialManager" }
credentials-play-services = { group = "androidx.credentials", name = "credentials-play-services-auth", version.ref = "credentialManager" }
googleid = { group = "com.google.android.libraries.identity.googleid", name = "googleid", version.ref = "googleIdentity" }
```
