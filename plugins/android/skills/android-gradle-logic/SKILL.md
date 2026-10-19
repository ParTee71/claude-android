---
name: android-gradle-logic
description: Use when setting up or refactoring Android Gradle build logic — convention plugins, composite builds, version catalogs, and shared build configuration across modules. Svenska trigger-ord: gradle, bygg, byggfil, beroende, lägga till bibliotek, versionskatalog, modul, plugin, byggtid, compileSdk, targetSdk, AGP, cpdCheck, Spotless.
---

# Android Gradle Build Logic

Build logic lives in **one place** and every version in the version catalog – never
copy-pasted configuration across modules. The repo's real setup (versions, SDK levels, modules,
where the shared configuration lives, why) is in repots CLAUDE.md and the documents it points
to – the only source; this skill describes the rules, not the numbers.

## Version catalog rules

- Every dependency and plugin version is in `gradle/libs.versions.toml`; build files use
  `libs.…` only.
- BOMs keep families in sync: Compose BOM for Compose, Firebase BOM for Firebase (no
  `-ktx` artefacts). A library pinned outside its BOM (e.g. `material3` for the Expressive
  APIs) gets a comment in the catalog saying why. Material 3 is pinned to beta or stable,
  never alpha (skill `android-dev`, platform requirements).
- AGP 9 has built-in Kotlin: the app module does **not** apply `org.jetbrains.kotlin.android`.
  The Kotlin version comes from the `kotlin-jvm` plugin declared in the root `plugins {}`.
- Use `kotlin.plugin.compose` (separate plugin since Kotlin 2.0) – never `buildFeatures.compose = true` alone.
- KSP for annotation processing (Hilt, Room) – KAPT is not used.
- AGP aligns `androidTest` dependencies with the app's resolved versions. When a test
  library needs a newer version than the app resolves ("Cannot find a version … strictly …"),
  raise it in a `constraints {}` block in the app's build file with a comment naming the
  test library – never by disabling the alignment.
- The Java target (17 or 21, via `jvmToolchain` or via `sourceCompatibility`/`targetCompatibility`
  + Kotlin's `jvmTarget`) is the repo's and must match CI – se repots CLAUDE.md.
- SDK levels: `targetSdk` 36 is required for Play updates from 2026-08-31; `compileSdk` ≥ `targetSdk`.
  A bump that changes SDK levels updates the repo's requirements in the same PR.
- Dependency updates come as grouped Renovate/Dependabot PRs (skill `android-dev`).

## GitHub Packages (android-ui)

Appar som hämtar biblioteket android-ui lägger GitHub Packages-repot i `settings.gradle.kts`
(`dependencyResolutionManagement.repositories`), filtrerat till gruppen så att inget annat söks där:

```kotlin
maven("https://maven.pkg.github.com/ParTee71/android-ui") {
    name = "androidUi"
    credentials {
        username = providers.environmentVariable("GPR_USER")
            .orElse(providers.environmentVariable("GITHUB_ACTOR")).orNull
        password = providers.environmentVariable("GPR_TOKEN")
            .orElse(providers.environmentVariable("GITHUB_TOKEN")).orNull
    }
    content { includeGroup("se.partee71.ui") }
}
```

- **CI** läser med `GITHUB_TOKEN` (sätt `env: GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}` på
  Gradle-steget och `permissions: packages: read`). Paketet måste ha gett appens repo läsrätt
  (paketets inställningar → Manage Actions access).
- **Molnsessioner** läser med `GPR_USER`/`GPR_TOKEN` (classic token med bara `read:packages`) från
  miljöns variabler. Lokalt: samma variabler eller `~/.gradle/gradle.properties`.
- Token checkas aldrig in, loggas aldrig och klistras aldrig in i chatten.
- **Felet "Could not resolve se.partee71.ui:…" med 401** betyder att token saknas eller är fel:
  kontrollera att `GPR_TOKEN` finns i miljön (`test -n "$GPR_TOKEN"`) och att sessionen startades
  efter att den lades in. **403** betyder att repot inte fått läsrätt till paketet.
- Bibliotekets version står i appens `libs.versions.toml` (`androidUi = "x.y.z"`) som alla andra.

## Modules

- A pure Kotlin/JVM module (e.g. `:core`) has **no Android or Firebase dependencies**, ever – that
  is what keeps its tests fast and runnable without an Android SDK.
- The app module depends on it with `implementation(project(":core"))`.
- Which modules the repo has – se repots CLAUDE.md.

## Shared configuration lives in one place

Java target, Kotlin compiler flags, test timeout and test logging are configured **once** – in
the root `build.gradle.kts` (`subprojects {}` with `plugins.withId {}`) or in a convention
plugin – never copy-pasted into several module files. Module files contain only what is unique
to the module.

### When to use convention plugins
With two modules the root `subprojects {}` block is enough. From three modules, or when the
root block grows hard to read, move it to a `build-logic/` composite build:

```kotlin
// settings.gradle.kts
pluginManagement {
    includeBuild("build-logic")
    repositories { google(); mavenCentral(); gradlePluginPortal() }
}

// build-logic/settings.gradle.kts
dependencyResolutionManagement {
    repositories { google(); mavenCentral() }
    versionCatalogs { create("libs") { from(files("../gradle/libs.versions.toml")) } }
}
rootProject.name = "build-logic"
include(":convention")
```

```kotlin
class AndroidApplicationConventionPlugin : Plugin<Project> {
    override fun apply(target: Project) = with(target) {
        pluginManager.apply("com.android.application")   // AGP 9: Kotlin is built in
        extensions.configure<ApplicationExtension> {
            compileSdk = libs.findVersion("compileSdk").get().requiredVersion.toInt()
            defaultConfig { targetSdk = libs.findVersion("targetSdk").get().requiredVersion.toInt() }
        }
    }
}
```

## Root-level tasks and build performance

- `cpdCheck` (copy-paste detector, PMD CPD for Kotlin via PMD's CLI as a `JavaExec` task – the
  `de.aaschmid.cpd` plugin does not work with Gradle 9) over main and test sources, wired into `check`.
- `spotlessCheck` (ktlint + compose-rules) as a fast check; `spotlessApply` fixes.
- Build performance flags in `gradle.properties`: `org.gradle.caching=true`,
  `org.gradle.configuration-cache=true`, `org.gradle.parallel=true`.
- Baseline Profile generation (`androidx.baselineprofile`) runs in the release flow, not in PRs.

## Firebase config

- `google-services` plugin applied only in the app module, and only when
  `app/google-services.json` exists.
- Whether `google-services.json` is checked in (it is client config, not a secret) or
  git-ignored and written from a CI secret is the repo's choice – se repots CLAUDE.md.
- Builds without the JSON still compile: a debug-only stub resource (`app/src/authStub/res`,
  added to the debug source set only when the JSON is missing) provides `default_web_client_id`
  and a Firebase config for a `demo-…` project, so auth code compiles and the app starts;
  sign-in simply fails at runtime there.
- Room: `exportSchema = true` and the `schemas/` directory committed.

## Checklist

- [ ] All versions in `libs.versions.toml` – no hardcoded versions in build files
- [ ] Firebase uses the BOM; Material 3 on beta or stable
- [ ] The JVM module has no Android/Firebase dependency
- [ ] Shared build settings exist once; module files only contain what is unique to the module
- [ ] `targetSdk` 36 (Play requirement for updates from 2026-08-31)
- [ ] Builds without `google-services.json` still compile
- [ ] New dependency or plugin: build-time impact stated in the PR (repots CI-budget, se repots CLAUDE.md)
