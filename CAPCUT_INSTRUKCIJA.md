# Kā uztaisīt dokumentālo YouTube video ar ChatGPT Plus + CapCut

Pilna instrukcija, kā izveidot 8-12 minūšu faceless mistēriju/dokumentālo video,
izmantojot tikai ChatGPT Plus abonementu (€23) un bezmaksas CapCut.

**Aptuvenais laiks vienam video: 2-4 stundas**
**Papildu izmaksas: €0** (viss iekļauts abonementā + bezmaksas rīki)

---

## KAS TEV VAJAG

| Rīks | Izmaksas | Kam |
|------|----------|-----|
| ChatGPT Plus | Jau ir (€23) | Attēli (DALL·E 3) + teksts |
| CapCut (Desktop) | Bezmaksas | Montāža, Ken Burns, subtitri |
| ElevenLabs (bezmaksas tier) | €0 | Balss (10,000 rakstzīmes/mēn bez maksas) |
| Scenārijs | Jau ir | `scenarios/` mapē |

> **Padoms:** Lejupielādē CapCut **Desktop** versiju (ne mobilo) — tā ir daudz labāka montāžai.
> capcut.com/download

---

## SOLIS 1: Sagatavo scenāriju (10 min)

1. Atver kādu scenāriju, piem. `scenario_01_dyatlov_pass.md`
2. Tev būs vajadzīgi 3 elementi no katras ainas:
   - **Narration** (ko runās balss)
   - **Image Prompt** (attēla apraksts)
   - **Subtitle** (teksts ekrānā)

Iesaku izveidot vienkāršu tabulu (Excel/Google Sheets) ar kolonnām:
`Aina | Narācija | Attēla prompts | Subtitrs`

---

## SOLIS 2: Ģenerē attēlus ar ChatGPT (45-60 min)

Tava ChatGPT Plus abonements iekļauj DALL·E 3 attēlu ģenerēšanu — BEZ papildu maksas.

### Kā:
1. Atver ChatGPT
2. Katrai ainai ielīmē attēla promptu šādā formātā:

```
Generate a 16:9 landscape image, cinematic photorealistic, 4K:
[ŠEIT IELĪMĒ IMAGE PROMPT NO SCENĀRIJA]
```

**Piemērs:**
```
Generate a 16:9 landscape image, cinematic photorealistic, 4K:
Snow-covered Ural Mountains at dusk, ominous dark clouds gathering
over a remote mountain pass, footprints disappearing into a blizzard
```

3. Lejupielādē katru attēlu
4. Saglabā ar skaidru nosaukumu: `aina_01.png`, `aina_02.png`, utt.

### Padomi:
- **Lūdz 16:9 formātu** vienmēr (horizontāls, ne kvadrāts)
- Ja attēls neizdodas, pievieno: "no text, no watermark, no people facing camera"
- DALL·E 3 dienas limits ir ~40-50 attēli ChatGPT Plus — lielam video varbūt jāsadala 2 dienās
- Saglabā konsekventu stilu — pievieno "documentary style, muted colors, dramatic lighting"

---

## SOLIS 3: Ģenerē balsi (30 min)

### Variants A — ElevenLabs (labākā kvalitāte, bezmaksas tier)
1. Reģistrējies elevenlabs.com (bezmaksas: 10,000 rakstzīmes/mēnesī)
2. Izvēlies balsi (iesaku "Adam" vai "Brian" — dokumentālam tonim)
3. Katrai ainai ielīmē narācijas tekstu → Generate → Download MP3
4. Saglabā: `audio_01.mp3`, `audio_02.mp3`, utt.

> 10,000 rakstzīmes ≈ viens 10 min video. Ja vairāk — gaidi nākamo mēnesi vai
> izmanto vairākus bezmaksas kontus.

### Variants B — CapCut iebūvētā Text-to-Speech (pilnīgi bezmaksas)
1. CapCut ir iebūvēta balss ģenerēšana
2. Ievieto tekstu → izvēlies balsi → CapCut uztaisīs balsi automātiski
3. Kvalitāte mazliet zemāka par ElevenLabs, bet bezmaksas un neierobežota

---

## SOLIS 4: Montāža CapCut (60-90 min)

### 4.1 Izveido projektu
1. Atver CapCut Desktop → "New Project"
2. Iestati izšķirtspēju: **1920x1080, 30fps** (Export iestatījumos)

### 4.2 Ievieto attēlus
1. Importē visus attēlus (`aina_01.png` ... `aina_XX.png`)
2. Velc tos uz laika līniju pareizā secībā
3. Katra attēla ilgumu pielāgo audio garumam (parasti 15-20 sek)

### 4.3 Pievieno balsi
1. Importē audio failus
2. Novieto katru audio zem atbilstošā attēla
3. Pielāgo attēla garumu, lai sakristu ar audio

### 4.4 Ken Burns efekts (lēna kustība)
Šis ir SVARĪGI dokumentālam izskatam:
1. Izvēlies attēlu laika līnijā
2. Atver "Animation" → "Zoom in" vai "Zoom out"
3. VAI manuāli: izmanto keyframes —
   - Sākumā: scale 100%
   - Beigās: scale 110% (lēns zoom)
4. Maino virzienu starp ainām (zoom in, tad zoom out, tad pan)

### 4.5 Subtitri (Netflix stils)
1. CapCut → "Captions" → "Auto captions" (automātiski no audio!)
   VAI manuāli ievieto subtitrus no scenārija
2. Stils:
   - Balts teksts, treknraksts
   - Melna kontūra/ēna
   - Novietojums: **apakšā** (CapCut: "Bottom")
   - Fonta izmērs ~48-60px
3. CapCut auto-captions ir ļoti ērti — tas pats atpazīst balsi un uzliek subtitrus

### 4.6 Pārejas un mūzika
1. Starp ainām pievieno smalkas pārejas: "Fade" vai "Dissolve" (NE flashy)
2. Pievieno fona mūziku:
   - CapCut bezmaksas mūzikas bibliotēka
   - Vai YouTube Audio Library (bezmaksas)
   - Izvēlies: dark ambient, cinematic, low strings
   - Skaļumu samazini uz ~15-20% (lai balss dominē)

---

## SOLIS 5: Eksports (10 min)

1. Click "Export"
2. Iestatījumi:
   - **Resolution: 1080p (1920x1080)**
   - **Frame rate: 30fps**
   - **Format: MP4**
   - **Quality: High / Recommended**
3. Eksportē → Gatavs YouTube augšupielādei!

---

## SOLIS 6: YouTube augšupielāde

1. Nosaukums: pievilcīgs, bet ne clickbait
   - Piem.: "The Dyatlov Pass Incident: 9 Hikers Who Never Came Home"
2. Apraksts: īss kopsavilkums + avoti
3. Thumbnail: izmanto dramatiskāko attēlu + lielu tekstu
4. Tags: mystery, documentary, unsolved, true crime, history

---

## ĀTRAIS WORKFLOW (kad esi apguvis)

```
1. Scenārijs → tabula (10 min)
2. Attēli ChatGPT pa partijām (45 min)
3. Balss ElevenLabs/CapCut (30 min)
4. CapCut: attēli + audio + Ken Burns + auto-subtitri (60 min)
5. Eksports 1080p (10 min)
─────────────────────────────
KOPĀ: ~2.5 stundas vienam video
```

---

## PADOMI PRODUKTIVITĀTEI

- **Partiju darbs:** Ģenerē VISUS attēlus vienā sesijā, tad VISU balsi, tad montāža
- **Šabloni:** Saglabā CapCut projektu kā šablonu (subtitru stils, pārejas) — nākamreiz ātrāk
- **Konsekvence:** Izmanto to pašu balsi un mūzikas stilu visiem video → atpazīstams zīmols
- **Auto-captions:** CapCut auto-subtitri ietaupa 30+ minūtes katrā video
- **Sērijveida ražošana:** Ar šo workflow vari uztaisīt 2-3 video nedēļā

---

## BIEŽĀKĀS KĻŪDAS

| Problēma | Risinājums |
|----------|-----------|
| Attēli kvadrātā | Vienmēr lūdz "16:9 landscape" |
| Balss izklausās robotiska | Izmanto ElevenLabs, ne CapCut TTS |
| Subtitri vidū | CapCut: iestati pozīciju uz "Bottom" |
| Mūzika pārspēj balsi | Samazini mūziku uz 15-20% |
| Video pārāk garš/īss | Mērķis 8-12 min = ~30-40 ainas |
| Zoom pārāk ātrs | Ken Burns: max 110% scale, lēni |

---

Veiksmi ar video! 🎬
