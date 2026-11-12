---
name: ai-model-choice
description: Modellval för Claude i alla Mats projekt (Android-repona, android-ui, Husjakt, VeckansMat) – Opus 5.5 som standard, Fable 5.2 bara när uppgiften kräver det och då med Medium/High effort. Ladda när arbete planeras, när modell eller effort väljs för sessionen, en agent eller ett issues Agent · modell · effort, och före en dyr uppgift (stor refaktorering, flera agenter, lång session). Trigger-ord: modell, modellval, effort, Opus, Fable, Sonnet, Haiku, /model, dyrt, kostnad, tokens, Agent · modell · effort.
---

# Modellval för Claude (läge november 2026)

Enda källan för modellvalet. Repons CLAUDE.md har regeln i korthet och länkar hit; skills och
agenter som anger modell (issuets **Agent · modell · effort**, agenternas `model`) följer tabellen.

## Regeln

- **Standard: Opus 5.5** (`claude-opus-5-5`) – vardagskod, enskilda issues, tester, granskning och
  rutinändringar.
- **Fable 5.2** (`claude-fable-5-2`) **är ok när det behövs, men används försiktigt för kostnadens
  skull.** Bara när uppgiften motiverar det:
  - arkitektur- eller datamodelldesign (flera lager, migrering, backup-kedjan, rules)
  - knepiga integrationer mot plattformen (till exempel Health Connect i Dagboken)
  - långa agentuppgifter i många steg, eller buggar som Opus 5.5 redan misslyckats med
- **Fable 5.1 används inte längre.** Fable 5.2 är billigare per token, snabbare och starkare.
- **Planera med Fable, genomför med Opus** när det går.

| Uppgift | Modell |
|---|---|
| Uppslag och läsning – loggar, data, sökningar | Haiku |
| Små avgränsade ändringar – en fil, en komponent, ett test | Sonnet |
| Standard: kod, issues, flera lager, datamodell, migrering, granskning | Opus 5.5 |
| Väldigt komplexa issues, svår arkitektur, knepiga integrationer, buggar Opus inte klarat | Fable 5.2 · medium/high |

**Agenter** anger alltid en egen `model` efter jobbet, aldrig `inherit` (Mats 2026-11-10: en
granskare ska köra lämplig modell för jobbet, precis som en tråd). Granskare: `opus`.
CI-doktor och testskrivare: `sonnet`.

**Inbyggda agenttyper** har ingen frontmatter att sätta modell i. `Explore` och `Plan` är
definierade som `inherit` och ska då köra trådens modell om inte `model` anges vid start – men ett
prov 2026-11-12 gav `Explore` Opus 5.5 på en Fable-tråd utan att variabeln nedan var satt (ett
prov, orsaken inte utredd). Lita inte på något av det: ange alltid `model` när de startas, `haiku`
för `Explore` och ren sökning eller läsning, `opus` för `Plan` och `general-purpose`.
Skyddsnät: `CLAUDE_CODE_SUBAGENT_MODEL=opus` som variabel i molnmiljön (claude-android README →
Installation; i `settings.json` verkar den inte, eftersom miljöbilden inte byggs om i varje tråd).
Den gäller agenter utan `model` alls – `general-purpose` och kopierade agentfiler som
VeckansMats `svelte-file-editor` – men enligt Claude Code 2.1.322 inte `Explore` och `Plan`,
eftersom `inherit` går före variabeln (i äldre versioner, t.ex. 2.1.42, vann variabeln över all
modell – då blir även `sonnet`-agenter Opus). Hooken `repo-sync` säger till när variabeln saknas.
Bara i molnsessioner; lokalt gäller regeln ovan.

## Kostnadsspärrar för Fable 5.2

- **Säg först varför.** Innan du byter till Fable 5.2: skriv kort varför uppgiften kräver den och
  vilken effort som används. I ett issue står det i **Agent · modell · effort**.
- **Medium** (Claude Codes standard) eller **High** effort. Undvik **Max**: kostnaden per uppgift
  kan bli ungefär dubbla Fable 5.1:s.
- Fable 5.2 på High motsvarar ungefär Opus 5.5 på Max i kod, till ungefär halva kostnaden per
  uppgift – jämför alltså med Opus på Max, inte Opus på standard.
- **Inget fast mode** ($16/$80) om inte farten verkligen spelar roll.
- På ett Pro-abonnemang får Fable ta högst 50 % av veckans användning. Lägg den på planering och
  svåra problem, och lämna tillbaka genomförandet till Opus 5.5.

## Referenspriser (per 1M tokens, Anthropics listpriser)

| Modell | In / ut | Cacheläsning |
|---|---|---|
| Opus 5.5 | $4 / $20 | $0,20 |
| Fable 5.2 | $8 / $40 | $0,20 |
| Fable 5.2 fast mode | $16 / $80 | – |

Modell-ID: `claude-opus-5-5`, `claude-fable-5-2`.

## Håll aktuellt

Modeller och priser ändras. Gäller frågan de senaste modellerna eller priserna: kontrollera med en
webbsökning innan tabellen används, och märk leverantörens egna jämförelser som sådana.
