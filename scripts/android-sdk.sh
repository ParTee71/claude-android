#!/bin/bash
# Installerar Android SDK:ns kommandoradsverktyg i /opt/android-sdk och accepterar licenserna.
# Körs av molnmiljöns setup-skript (README → Installation), så att SDK:n ligger i miljöbilden och
# inte laddas ned i varje tråd. Plattform och build-tools hämtar Gradle själv efter compileSdk.
# Idempotent. Repona hittar SDK:n via ANDROID_HOME eller sin egen local.properties.
set -euo pipefail
sdk="${ANDROID_HOME:-/opt/android-sdk}"
if [ -x "$sdk/cmdline-tools/latest/bin/sdkmanager" ] && [ -d "$sdk/licenses" ]; then
  echo "Android SDK finns redan: $sdk"
  exit 0
fi
mkdir -p "$sdk/cmdline-tools"
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
curl -sSfo "$tmp/clt.zip" https://dl.google.com/android/repository/commandlinetools-linux-9862592_latest.zip
unzip -q "$tmp/clt.zip" -d "$tmp"
rm -rf "$sdk/cmdline-tools/latest"
mv "$tmp/cmdline-tools" "$sdk/cmdline-tools/latest"
yes | "$sdk/cmdline-tools/latest/bin/sdkmanager" --licenses >/dev/null 2>&1 || true
"$sdk/cmdline-tools/latest/bin/sdkmanager" "platform-tools" >/dev/null
echo "Android SDK installerad: $sdk ($(du -sh "$sdk" | cut -f1))"
