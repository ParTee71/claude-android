# claude-android

Gemensam Claude Code-plugin för ReseApoteket, Dagboken och fonder. Här ligger det som
är generellt för de tre Android-repona: Kotlin, Compose, Navigation 3 och arbetssättet
kring issues och PR:er. Det som är eget för ett repo stannar i repots `.claude/`.

Lokalt installeras den med

    /plugin install android --marketplace ParTee71/claude-android

Ett repo slår på pluginen i `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-android": { "source": { "source": "github", "repo": "ParTee71/claude-android" } }
  },
  "enabledPlugins": { "android@claude-android": true }
}
```

Skillsen anropas då som `android:<namn>`, till exempel `android:navigation-3`.
