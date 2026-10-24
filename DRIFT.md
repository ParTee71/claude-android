# Drift – konton, tjänster, nycklar och gratiskvoter

Kartan över var Mats projekt körs och vad de hänger på, på ett ställe (#28). Bara namn och
var saker finns – **aldrig värden, nycklar eller driftadresser**. Husjakts adress, familj och
källor står i Husjakts egen `CLAUDE.md`.

Läget 2026-10-24, efter städningen i #26 och #27. Talen under *Gratiskvoter* är kontrollerade
mot leverantörernas sidor samma dag.

## Repona

| Repo | Synlighet | Drift | Konto | Data | Deploy | Claude-miljö |
|---|---|---|---|---|---|---|
| ReseApoteket | publik | Firestore + Auth | Firebase `reseapoteket` | Firestore | rules och backup i Actions | Android |
| Dagboken | publik | Firestore + Auth | Firebase `dagboken-711d2` | Firestore | rules och backup i Actions | Dagboken |
| fonder | publik | Room lokalt, Drive-backup, Auth | Firebase `dagboken-711d2` (eget projekt planerat, fonder#225) | på telefonen + Drive | APK i Actions | Android |
| Husjakt | **privat** | Worker, D1, R2, Pages, 2 cron-uttryck | Cloudflare | D1 + R2 | Actions → `wrangler` | Webb |
| VeckansMat | publik | Worker med statiska filer | Cloudflare | – | `release.yml` → `wrangler` | Webb |
| android-ui | publik | Maven-paket | GitHub Packages | – | `publish.yml` | Android |
| claude-android | publik | plugin, ingen drift | – | – | – | Android |

Husjakt förblir privat (dess `CLAUDE.md`: API utan inloggning och familjens data i historiken).
Alla publika repon har secret scanning, push protection och regeln *Restrictions*
(standardgrenen kan inte raderas eller skrivas över med force push).

## Konton

| Konto | Plan | Vad som ligger där | Konsol |
|---|---|---|---|
| GitHub `ParTee71` | Free | alla repon, Actions, Packages | [github.com/ParTee71](https://github.com/ParTee71) |
| Firebase / Google Cloud | Spark (gratis) | ett projekt per app: `reseapoteket`, `dagboken-711d2` (Dagboken och tills vidare fonder) | [console.firebase.google.com](https://console.firebase.google.com/) |
| Cloudflare | Workers Free | Husjakt och VeckansMat | [dash.cloudflare.com](https://dash.cloudflare.com/) |
| Claude | – | projekten och molnmiljöerna | [claude.ai/code](https://claude.ai/code) |

## Gratiskvoter som faktiskt begränsar

| Tjänst | Gräns (gratis) | Vem tar av den |
|---|---|---|
| Cloudflare Workers | 100 000 anrop/dygn, 10 ms CPU och 50 underanrop per anrop | Husjakt, VeckansMat |
| Cloudflare Cron Triggers | **5 uttryck per konto** (ett uttryck kan ha flera klockslag) | Husjakt 2, lediga 3 (Husjakt#369) |
| Cloudflare D1 | 5 GB totalt, 500 MB per databas, 5 M radläsningar och 100 000 radskrivningar per dygn | Husjakt |
| Cloudflare R2 | 10 GB-månad, 1 M klass A- och 10 M klass B-anrop per månad, fri utgående trafik | Husjakt (bilder) |
| Firestore (Spark, per projekt) | 1 GiB, 50 000 läsningar, 20 000 skrivningar och 20 000 raderingar per dygn | ReseApoteket, Dagboken |
| Firebase Auth (Spark) | 50 000 aktiva användare per månad | alla tre appar |
| GitHub Actions | 2 000 min/mån **bara för privata repon**; publika är gratis | bara Husjakt |
| GitHub Packages | 500 MB lagring (delas med Actions-artifacter) för privata repon | – (android-ui är publikt) |

Källor: Cloudflare [Workers](https://developers.cloudflare.com/workers/platform/limits/),
[D1](https://developers.cloudflare.com/d1/platform/pricing/),
[R2](https://developers.cloudflare.com/r2/pricing/), [Firebase](https://firebase.google.com/pricing),
[GitHub](https://docs.github.com/en/billing/concepts/product-billing/github-actions).

## Hemligheter per repo (GitHub Actions)

Bara namnen. Ta fram listan på nytt med
`grep -rhoE 'secrets\.[A-Z_0-9]+' <repo>/.github/workflows | sort -u`.

| Repo | Hemligheter | Ger åtkomst till |
|---|---|---|
| [ReseApoteket](https://github.com/ParTee71/ReseApoteket/settings/secrets/actions) | `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_RULES_DEPLOYER`, `BACKUP_PASSPHRASE`, `GOOGLE_SERVICES_JSON`, `GPR_TOKEN`, `SIGNING_*` (4) | Firestore (läs/backup), rules-deploy, backupkryptering, appkonfig, android-ui-paketen, release-signering |
| [Dagboken](https://github.com/ParTee71/Dagboken/settings/secrets/actions) | `FIREBASE_SERVICE_ACCOUNT`, `FIREBASE_RULES_DEPLOYER`, `BACKUP_PASSPHRASE`, `GPR_TOKEN`, `SIGNING_*` (4) | samma som ovan |
| [fonder](https://github.com/ParTee71/fonder/settings/secrets/actions) | `GPR_TOKEN`, `SIGNING_*` (4) | android-ui-paketen, release-signering |
| [Husjakt](https://github.com/ParTee71/Husjakt/settings/secrets/actions) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`, `GEOTORGET_ANVANDARE`, `GEOTORGET_LOSENORD` | Worker/D1/R2/Pages-deploy, Lantmäteriets adressdata |
| [VeckansMat](https://github.com/ParTee71/VeckansMat/settings/secrets/actions) | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | Worker-deploy |
| android-ui, claude-android | inga (publiceringen använder `GITHUB_TOKEN`) | – |

**Rotera en nyckel:** skapa den nya hos leverantören (Firebase: servicekontot → Keys; Cloudflare:
My Profile → API Tokens; GitHub: Settings → Developer settings), lägg in den på hemlighetssidan
ovan, kör det workflow som använder den, och ta sedan bort den gamla hos leverantören.

## Claude-projekt och molnmiljöer

En repolista ger **ingen läsbehörighet**: varje repo i listan går att pusha till, och miljöns
nycklar syns för alla repon i projektet. Listorna hålls därför korta.

| Projekt | Repon | Miljö |
|---|---|---|
| Generella förbättringar | alla | Android |
| Appprojekt (ReseApoteket, Dagboken, fonder …) | bara sitt eget repo | Android (Dagboken: Dagboken) |
| VeckansMat, Husjakt | bara sitt eget repo | Webb |

claude-android behöver inte stå i appprojekten: setup-skriptet klonar det självt när det saknas
(README → *Installation → I molnsessioner*, enda källan för blocket). android-ui läses som
Maven-paket med `GPR_TOKEN` och behöver inte heller stå där.

| Miljö | Nätverk | Miljövariabler (namn) |
|---|---|---|
| Android | full | `GPR_TOKEN`, `GPR_USER`, `GH_TOKEN`, `FIREBASE_SERVICE_ACCOUNT` (läs, `reseapoteket`), `LC_ALL` |
| Dagboken | full | `GPR_TOKEN`, `GPR_USER`, Dagbokens nycklar |
| Webb | full | inga Cloudflare-nycklar – deploy sker i Actions |
| Default | inbyggd, går inte att ta bort | används inte |

**Regel:** läsnycklar i miljöer, skrivnycklar bara i GitHub-hemligheter eller i det egna
projektets miljö. Cloudflare-tokens aldrig i en Claude-miljö.

## Rutiner

**Nytt repo:** publikt om inget talar emot (gratis Actions). Slå på secret scanning, push
protection och regeln *Restrictions*. Lägg det i ett projekt med rätt miljö. Behöver det
hemligheter, lägg dem i repots Actions-hemligheter och lägg till en rad här.

**Ny Cloudflare-resurs:** en API-token per repo med bara de rättigheter repot behöver.
Ett nytt cron-uttryck tar en av kontots fem – skriv in det i tabellen ovan.

**Nytt Firebase-behov:** ett projekt per app på Spark. En servicekontonyckel per syfte
(läsa, deploya rules, backup) med minsta roll.
