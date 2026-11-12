---
name: arbetsflode
description: Arbetsflödets stomme för alla Mats repon (Android-repona, android-ui, Husjakt, VeckansMat) – idé till issue (mallen, Agent · modell · effort, stoppet för ok) och issue till PR (förra PR:en via GitHub, kontraktet i issuet, bugg med test först, kontroller före push, granskning i rundor, en push, PR-texten, bevakning, mergeable_state, konflikter, rött CI, merge). Enda källan för stommen; repots egna skills (android:implement-issue, android:refine-issue, VeckansMats implement-issue och refine-issue, Husjakts genomfor och forfina) lägger sina steg ovanpå. Ladda tillsammans med repots skill när ett issue ska förfinas eller genomföras, före en PR, och vid PR-händelser. Trigger-ord: issue, förfina, planera, genomför, implementera, kör #N, kör nästa, PR, push, granska, konflikt, mergeable_state, rött CI, merga, bevaka.
---

# Arbetsflödets stomme (alla Mats repon)

Enda källan för det som är lika i alla repon. Repots skill säger vad som gäller *där*: stack,
kommandon, granskare, versionsfiler, egna spärrar. Där repots skill och stommen krockar gäller
repots skill – den får skärpa, aldrig lätta. Reglerna om när en plan krävs, när tråden mergar
själv, instabila tester och modellval står i `arbetsregler` och `ai-model-choice`.

| Repo | Idé till issue | Issue till PR | Granskare | Rött CI |
|---|---|---|---|---|
| ReseApoteket, Dagboken, fonder, android-ui | `android:refine-issue` | `android:implement-issue` | agent `android:granskare` | agent `android:ci-doktor` |
| VeckansMat | `refine-issue` | `implement-issue` | agent `granskare` | agent `ci-doktor` |
| Husjakt | `forfina` | `genomfor` | skill `granska` | – (läs loggen själv) |

## Idé till issue

1. **Fånga och klassa:** har du ett nummer, läs issuet **och kommentarerna** först. Återge begäran i en eller två meningar – funktion, bugg eller
   underhåll. Sök dubbletter bland öppna och stängda issues; ett stängt `beslut`-issue är ofta
   svaret.
2. **Klargör bara det som inte går att härleda** ur begäran, koden eller ett avgjort issue.
   Samla frågorna, förhör inte; konkreta val som alternativ med konsekvens, rekommendationen först.
3. **Undersök koden** och anteckna filsökvägar. Vad repots regler kräver av ändringen (data,
   återbruk, krav, tester, CI-kostnad, version, integritet) står i repots skill.
4. **Mockup före ny GUI** – repots mockup-skill, länken under **Design**.
5. **Skriv issuet** med mallen nedan. Ett befintligt issue skrivs om i sin helhet, inte med
   tillägg sist.
6. **Större ändring → stopp.** Visa länken och de öppna frågorna och avsluta turen: ingen gren,
   ingen kod. Mats ok ("kör" eller etiketten `plan-godkänd`) skrivs in i issuet som en kommentar
   med var, när och hans ord. Sätt aldrig etiketten utan ett ok.

Mallen (repots skill lägger till rubriker):

```markdown
## Sammanfattning         <vad och varför>
## Design                 <mockup-länk, eller "ingen GUI-ändring">
## Föreslaget upplägg     <inom omfång> (bugg: Steg för att återskapa · Förväntat · Faktiskt)
## Berörda filer
## Testplan               <nivå: vad>
## Verifiering            <kommandon och utfall som visar att issuet är klart>
## Acceptanskriterier     - [ ] …
## Utanför omfång         <med nummer på issuet där det hör hemma>
## Öppna frågor / Beslut som behövs
## Agent · modell · effort  - <agent> · <modell> · <effort> – <vilken del>
```

**Agent · modell · effort är obligatoriskt** (`ai-model-choice`). Ett issue utan avsnittet är
inte färdigt. Stort arbete → under-issues, vart och ett med egen Verifiering.

## Issue till PR

### 0. Förra PR:en – fråga GitHub

En PR i taget per repo. Hämta den senaste PR:en från arbetsgrenen (`list_pull_requests`, head =
grenen, state `all`, och `pull_request_read`). Lita aldrig på ett antagande eller ett "mergad".

- **Mergad** → `git fetch origin <bas> && git checkout -B <gren> origin/<bas>`; avsluta
  bevakningen av den gamla.
- **Öppen** → säg det direkt. Förbered ocommittat tills den är mergad, annars hamnar arbetet i
  samma PR. Återställ aldrig grenen innan mergen är bekräftad.
- **Ingen** → grenen från `origin/<bas>`. Aldrig commit direkt på basgrenen.

### 1. Förstå

- Läs issuet **och kommentarerna** (`issue_read`, `get` och `get_comments`). Att göra,
  Acceptanskriterier, Verifiering, Utanför omfång, Design och Agent · modell · effort är
  kontraktet; senare kommentarer från Mats går före brödtexten.
- **Större eller liten** enligt `arbetsregler`. Större utan godkänd plan → idé till issue först.
- **Inte förfinat** – mallens avsnitt saknas (Agent · modell · effort, Verifiering, Acceptanskriterier
  eller repots motsvarighet) → repots förfina-skill först, och issuet skrivs om innan kod.
- **`beslut`-etikett eller "väntar på beslut"** → bygg inte förbi den; säg vilken fråga som blockerar.
- Mockup krävs och saknas under **Design** → gör den och vänta på ok innan kod.

### 2. Bygg – tester samtidigt, inte efter

- **Bugg:** ett test som faller först, sedan minsta ändringen som gör det grönt. Utöka inte omfånget.
- **Funktion:** följ befintliga mönster; delat först (egen commit), funktionen ovanpå.
- **Version:** ändrar PR:en appen höjs versionen i samma PR (repots release-skill); en ren
  dokument-, test- eller CI-ändring höjer inte.
- **Kör agenten, modellen och effort som issuet anger.** Avvikelse bara uppåt (fel två gånger
  i rad, större risk än väntat), med skälet i PR:en.
- Ett test tas aldrig bort, hoppas över eller försvagas för att bli grönt. Instabilt test:
  `arbetsregler`.

### 3. Kontrollerna lokalt

Kör repots kontroller och issuets **Verifiering** innan push. Det som inte går att köra lokalt
säger PR:en; CI får bekräfta.

### 4. Granska i rundor

1. Repots granskare på diffen, med raderna **Titta först på** och **Kan gå sönder** (steg 5) i
   uppdraget: granskaren börjar där men läser hela diffen och säger till om risken sitter
   någon annanstans. Blockerande fynd (❌) rättas; ett mindre (⚠️, `bör`) rättas om det är
   litet, annars nämns det i PR:en.
2. Den inbyggda `/code-review` när diffen är större än ett par filer eller rör data, schema,
   en extern källa, en delad komponent eller hooks. Verifiera varje fynd; rätta de verkliga.
3. Rättningar granskas igen – bara det som ändrats sedan förra rundan. Rundorna slutar när en
   runda inte hittar något blockerande. Ingen kod går ut som ingen granskning sett.

Spåra varje acceptanskriterium och varje rad i **Verifiering** till kod, test eller en körning.
Kan du inte köra den är du inte klar.

### 5. Commit, en push, PR

- Repots commit-stil (annars konventionella: `feat(område): …`, `fix(…)`, `docs(…)`, `test(…)`,
  `chore(…)`), små och sammanhängande commits, `Closes #N` i den sista, sessionens trailers sist.
- **En push**, när allt är grönt lokalt. Aldrig för att se om CI blir grönt, aldrig en tom commit.
- PR-texten:
  - vad och varför, `Closes #N` – eller raden `Liten ändring: <varför>`,
  - **Titta först på:** de 1–3 ställen (fil:rad) där ett fel kostar mest – datamodell, codec,
    rules, motor, workflow, hook,
  - **Kan gå sönder:** vad som realistiskt kan gå sönder och hur det skulle märkas, eller
    "inget utanför diffen" när det är sant – aldrig som slentrian,
  - **Verifiering** avbockad med kommandon och utfall, och vad som inte kunde köras,
  - versionen, eller "ingen höjning – ren dokument/test/CI",
  - kostnaden (Actions-minuter, byggtid, eval) när ändringen påverkar den, annars "oförändrad",
  - för GUI: mockup-länk och skärmdumpar,
  - repots tillägg (repots skill).
- Mats som assignee.

### 6. Bevaka till merge

- **Prenumerera direkt** (`subscribe_pr_activity`) utan att fråga.
- **Går den att merga?** Efter varje push, vid varje PR-händelse och alltid före merge: hämta
  PR:en (`pull_request_read`, `get`) och läs `mergeable_state`. `dirty` → lös konflikten.
  `unknown` → hämta igen. En PR med konflikt får inget nytt CI-utfall – grönt från förut betyder
  inte att den går att merga.
- **Konflikt:** merga in `origin/<bas>` i grenen – ingen rebase och ingen force-push för att lösa
  en konflikt. Version och ändringslogg: ta basens som de är och tillämpa
  versionsregeln på nytt; höj bara om PR:en är allvarligare. Kod: lös bara när båda sidornas
  avsikt är tydlig, annars fråga Mats med filerna och vad som krockar. Kör kontrollerna, pusha.
- **Rött CI** → repots ci-doktor diagnostiserar; rätta grundorsaken och pusha. Kör aldrig bara
  om. En omkörning startas först när hela körningen är klar (ett jobb som går kvar gör att en
  omkörning mitt i slutar i `startup_failure`), och bara när orsaken är åtgärdad utanför koden.
- **Merge:** när alla kontroller på senaste commit är gröna (ett hoppat jobb är okej, rött eller
  avbrutet inte) och `mergeable_state` inte är `dirty`, mergar tråden själv enligt
  `arbetsregler`, med `expectedHeadSha`. Avsluta bevakningen och gå till steg 0 för nästa.
- Skriv en rad i repots lärdomsfil om du lärde dig något om hur Claude bör styras – och i den
  här skillen om det gäller alla repon.

## Anti-mönster

- Nästa issue innan GitHub sagt att förra PR:en är mergad.
- Kod för en större ändring utan Mats ok, eller att kalla något litet för att slippa vänta.
- Bygga förbi en `beslut`-fråga.
- Kod för ny GUI utan godkänd mockup.
- Bugfix utan test som föll först.
- Ett rött test borttaget, hoppat, försvagat eller omkört för att bli grönt.
- Flera pushar för att se CI; merga utan att ha läst `mergeable_state`.
- En agent med annan modell eller effort än issuet anger, utan skäl i PR:en.
