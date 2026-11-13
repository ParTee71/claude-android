---
name: refine-issue
description: "Göra en halvfärdig idé, en buggrapport eller ett önskemål till ett förfinat, planerat GitHub-issue i ett Android-repo – stommen i skill android:arbetsflode plus Android-delarna – kodgenomgång mot repots fem regler, återbruk, datakedjan, krav, version, mockup för ny GUI, Definition of Done och Agent · modell · effort. Repodetaljerna står i repots android-projekt. Use when the user wants to \"create an issue\", \"update an issue\", \"plan a feature\", \"write up a bug\", \"refine this idea into a ticket\". Trigger-ord: skapa issue, nytt issue, uppdatera issue, planera, förfina, skriv upp en bugg, idé, önskemål, ticket. Pairs with implement-issue."
---

# Förfina och planera ett issue i ett Android-repo

**Stommen står i skill `android:arbetsflode` → Idé till issue** (fånga och klassa, klargör,
undersök, mockup, mallen, stoppet för ok). Den här skillen säger vad ett Android-repo lägger
till. Målet är ett issue som en annan session kan genomföra med `android:implement-issue` utan
fler frågor. Owner/repo, etiketter, repots extra undersökningspunkter och utkastets repodelar
står i repots `android-projekt` → **Issues**; där pluginen och repot krockar gäller repot.

Bugg: fråga efter steg, förväntat och faktiskt, enhet och Android-version, logcat.

## Undersök koden – Android-punkterna

- Vilka skärmar, ViewModels, repositories, datalager och domänfunktioner berörs?
- **Återbruk (regel 4):** vilka komponenter, ramar och byggstenar ur repots skill
  `shared-ui-components` används? Berörs en känd dubblett – slås den ihop först. Behövs något
  **nytt delat** – byggs det först.
- **Data (regel 1):** nytt eller ändrat persisterat fält, ny samling eller entitet? Då krävs
  hela kedjan i repots `data-safety-backup` – eller ett uttryckligt motiv till att det är cache.
- **Integritet:** loggas, lagras eller exporteras känslig data? Repots skill för integritet.
- **Krav (regel 3):** vilka ID:n i kravlistan berörs, eller behövs nya (`requirements-kravlista`)?
- **Tester (regel 2):** vilka finns, vilka nivåer berörs (repots `testing-strategy`)?
- **CI (regel 5):** nytt beroende eller steg? Byggtidseffekt (repots `ci-budget`)?
- **Version:** vilken semver-höjning (skill `android:release` → Versionshöjning)?
- Repots egna punkter (beräkningar, larm, externa källor, import, ombyggnad …):
  `android-projekt` → Issues.

Mockup: tabellen i skill `android:mockup`, mallen och datan i `android-projekt` → "Mockup".

## Definition of Done – de fem reglerna konkret

1. **Datasäkerhet** – hela datakedjan med rundturstest; eller "ingen persisterad ändring", eller
   motivet till att det är cache.
2. **Tester** – nivåer och klasser; kontraktstester för skärmar på ramarna; bugg →
   regressionstest som faller före fixen.
3. **Krav** – ID:n att lägga till, ändra eller stryka; versionshöjningen (eller "ingen").
4. **Enhetligt** – delade delar som används, nytt som byggs delat, dubblett som slås ihop;
   `UiConsistencyTest` och `cpdCheck` gröna.
5. **CI-budget** – nya beroenden och deras byggtidseffekt; eller "ingen påverkan".

Plus mockup för ny GUI, integritet och tillgänglighet där det är relevant. Gäller en regel inte,
skriv varför.

## Rubriker utöver stommens mall

```markdown
## Återbruk (regel 4)
- Ramar · Komponenter · Data/domän · Dubblett som slås ihop · Nytt delat som byggs först · Feature-kod
## Datasäkerhet          <fält/samling och kedjan, eller "ingen persisterad ändring">
## Krav (kravlistan)      - <ID och radtext> · Version: <major/minor/patch och skäl, eller "ingen höjning">
```

Acceptanskriterierna får de fem reglernas rader när de gäller: mockup och skärmdumpar, datakedjan
och rundturstest, kravlistan och versionen, tester, `UiConsistencyTest` och `cpdCheck`. Repots
tillägg (fler rubriker, testnivåer, verifieringsexempel): `android-projekt` → Issues.

**Agent · modell · effort:** repots agenter står i `android-projekt` → Issues. Datamodell, rules,
migrering och backup-kedjan minst Opus · high. Titel: `<område>: <sammanfattning i imperativ>`.
Etiketter: `android-projekt` → Issues (hämta repots verkliga etiketter om du är osäker).

## Efteråt

Erbjud kort: genomför nu (`android:implement-issue`, helst i en ny tråd så att genomförandet får
ren kontext med issuet som underlag), skapa uppföljande issues för det som låg utanför omfånget,
eller låt det ligga planerat.
