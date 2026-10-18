---
name: refine-issue
description: Göra en halvfärdig idé, en buggrapport eller ett önskemål till ett förfinat, planerat GitHub-issue — klargör avsikten, undersök koden, avgränsa omfång och acceptanskriterier utifrån repots fem regler, mockup för ny GUI, ange Agent · modell · effort, och skapa eller uppdatera issuet efter bekräftelse. Repodetaljerna står i repots android-projekt. Use when the user wants to "create an issue", "update an issue", "plan a feature", "write up a bug", "refine this idea into a ticket". Trigger-ord: skapa issue, nytt issue, uppdatera issue, planera, förfina, skriv upp en bugg, idé, önskemål, ticket. Pairs with implement-issue.
---

# Förfina och planera ett issue

Gör en halvfärdig idé till ett GitHub-issue som en annan session (med `android:implement-issue`)
kan genomföra utan fler frågor.

Gå igenom stegen i ordning. Samla frågor, förhör inte. **Skapa eller uppdatera inte
issuet förrän i steg 7.**

Definition of Done (steg 5) vilar på de fem reglerna i repots CLAUDE.md. Ett förfinat issue
gör reglerna konkreta för *just den här* ändringen. Owner/repo, etiketter, repots extra
undersökningspunkter och utkastets repodelar står i repots `android-projekt` → avsnittet
**Issues**; där pluginen och repot krockar gäller repot.

### Nytt eller befintligt issue
- **Inget nummer** → alla steg, skapa nytt issue i steg 7.
- **Nummer angivet** → hämta med `mcp__github__issue_read` (owner och repo ur
  `android-projekt`), visa titel och innehåll, förfina och **uppdatera** i steg 7.

---

## Steg 1 – Fånga idén

Återge begäran i en eller två meningar. Klassa den:

| Typ | Signaler |
|---|---|
| **Funktion** | ny skärm, ny förmåga, "lägg till", "stöd för" |
| **Bugg** | "fel", "kraschar", "räknar fel", "fungerar inte" |
| **Underhåll** | refaktorering, beroende, bygg/CI, städning, ingen synlig ändring |

Sök efter dubbletter först: `mcp__github__search_issues` (`repo:<owner>/<repo> <ord>`).

## Steg 2 – Klargör avsikt

Fråga bara det som inte går att härleda ur begäran eller koden. Konkreta val ställs som en
fråga med alternativ – `AskUserQuestion` där det finns, annars ett beslutskort eller en kort
fråga i tråden. Bugg: steg, förväntat/faktiskt, enhet/Android-version, logcat. Hoppa över
steget om begäran redan är entydig.

## Steg 3 – Undersök koden

- Vilka skärmar, ViewModels, repositories, datalager och domänfunktioner berörs?
- **Återbruk (regel 4):** vilka komponenter, ramar och byggstenar ur tabellerna i repots skill
  `shared-ui-components` används? Berörs en känd dubblett? Då slås den ihop först. Behövs något
  **nytt delat**? Då byggs det först.
- **Data (regel 1):** nytt eller ändrat persisterat fält, ny samling eller entitet? Då krävs
  hela kedjan i repots skill `data-safety-backup` – eller ett uttryckligt motiv till att det är cache.
- **Integritet:** loggas, lagras eller exporteras känslig data? Repots skill för integritet.
- **Krav (regel 3):** vilka ID:n i kravlistan berörs, eller behövs nya (repots skill
  `requirements-kravlista`)?
- **Tester (regel 2):** vilka tester finns i dag, vilka nivåer berörs (repots `testing-strategy`)?
- **CI (regel 5):** nytt beroende eller nytt steg? Byggtidseffekt (repots `ci-budget`)?
- **Version:** ändras appens beteende? Vilken semver-höjning (skill `android:release` →
  Versionshöjning)?
- **Agent:** vilken del tar vilken agent, med vilken modell och effort (steg 6)?
- Repots egna punkter (beräkningar, larm, externa källor, import, ombyggnad …):
  `android-projekt` → Issues.

Anteckna konkreta filsökvägar.

## Steg 4 – Mockup (endast ny GUI)

Om ändringen är synlig enligt tabellen i skill `android:mockup` (mallen och datan:
`android-projekt` → "Mockup"): bygg mockupen nu, visa länken och vänta på ok innan issuet
skapas. Länken går in under **Design**. Padding, ordval eller ikonbyte → ingen mockup.

## Steg 5 – Omfång och Definition of Done

- **Inom omfång** – vad issuet levererar.
- **Utanför omfång** – vad det medvetet inte gör.
- **Acceptanskriterier** – observerbara, testbara punkter.

### Definition of Done – de fem reglerna konkret
1. **Datasäkerhet** – hela datakedjan för fältet eller samlingen (repots `data-safety-backup`,
   kedjan i `android-projekt` → Issues) med rundturstest; eller "ingen persisterad ändring",
   eller motivet till att det är cache.
2. **Tester** – nivåer och klasser; kontraktstester för skärmar på ramarna; bugg →
   regressionstest som faller före fixen.
3. **Krav** – ID:n att lägga till, ändra eller stryka; versionshöjningen (eller "ingen").
4. **Enhetligt** – vilka delade delar som används, vad nytt som byggs delat, vilken dubblett
   som slås ihop; `UiConsistencyTest` och `cpdCheck` gröna.
5. **CI-budget** – nya beroenden och deras byggtidseffekt; eller "ingen påverkan".

Plus **mockup** (Design) för ny GUI, **integritet** och **tillgänglighet** där det är relevant.
Gäller en regel inte, skriv varför. Stort arbete → föreslå uppdelning i under-issues
(`mcp__github__sub_issue_write`), var och en med egen DoD.

## Steg 6 – Utkast

```markdown
## Sammanfattning
<vad och varför>

## Design
<mockup-länk, eller "ingen GUI-ändring">

## Beteende / Föreslaget upplägg
1. …

## Återbruk (regel 4)
- Ramar: …
- Komponenter: …
- Data/domän: …
- Dubblett som slås ihop: … (eller "ingen")
- Nytt delat som byggs först: … (eller "inget")
- Feature-kod: …

## Berörda filer
- `app/src/main/…`

## Datasäkerhet
<fält/samling och kedjan, eller "ingen persisterad ändring">

## Krav (kravlistan)
- <ID och radtext>
- Version: <major/minor/patch och skäl, eller "ingen höjning">

## Testplan
- <nivå>: … (nivåerna i repots `testing-strategy`, inkl. kontraktstester och skärmdumpar)

## Verifiering
<kommandona och skärmdumparna som bevisar att issuet är klart>

## Acceptanskriterier
- [ ] <beteende>
- [ ] Mockup godkänd och skärmdumpar i PR:en (om GUI)
- [ ] Datakedjan komplett och rundturstest grönt (om data)
- [ ] Kravlistan uppdaterad och versionen höjd (om beteendet ändras)
- [ ] Tester tillagda/uppdaterade och gröna
- [ ] `UiConsistencyTest` och `cpdCheck` gröna

## Utanför omfång
- …

## Risker / Öppna frågor
- …

## Agent · modell · effort
- <agent> · <modell> · <effort> – <vilken del> (t.ex. `arkitekt` · Opus · high – datamodell och
  rules; `byggare` · Opus · medium – skärmen)
```

Repots tillägg till utkastet (fler rubriker, testnivåer, verifieringsexempel):
`android-projekt` → Issues.

För **buggar**: byt Föreslaget upplägg mot **Steg för att återskapa**, **Förväntat**,
**Faktiskt**, **Miljö**, och kräv regressionstestet.

**Agent · modell · effort är obligatoriskt.** Varje del anger agent (repots agenter:
`android-projekt` → Issues), modell och effort. Modell efter uppgiftens komplexitet, **Opus är
standard**:

| Uppgift | Modell |
|---|---|
| Uppslag och läsning – loggar, data, sökningar | Haiku |
| Små avgränsade ändringar – en fil, en komponent, ett test | Sonnet |
| Flera lager, datamodell, migrering, backup och granskning | Opus |
| Väldigt komplexa issues | Fable |

Datamodell, rules, migrering och backup-kedjan minst Opus · high, och Fable bara för väldigt
komplexa issues. Ett issue utan avsnittet är inte färdigförfinat.

Titel: `<område>: <sammanfattning i imperativ>`. Visa hela utkastet och **vänta på
bekräftelse**. Fråga om etiketter (repots etiketter: `android-projekt` → Issues; hämta repots
verkliga etiketter om du är osäker).

## Steg 7 – Skapa eller uppdatera

- **Nytt:** `mcp__github__issue_write` (method `create`, owner, repo, title, body, labels;
  `parent_issue_number` om det hör till en epic). Vid uppdelning: förälder först, sedan varje
  under-issue med `mcp__github__sub_issue_write`.
- **Befintligt:** `method: update` med hela den förfinade texten – lägg inte till i slutet.
  Behåll etiketterna om användaren inte vill ändra dem.

Rapportera nummer och länk. **Verktyg:** GitHub MCP (`mcp__github__*`); ingen `gh`.

## Steg 8 – Nästa steg

Erbjud kort: genomför nu (`android:implement-issue`, helst i en ny session eller tråd så att
implementationen får ren kontext med issuet som underlag), skapa uppföljande issues för det som låg
utanför omfånget, eller låt det ligga planerat.
