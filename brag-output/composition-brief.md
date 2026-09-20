# Hyperframes Composition Brief: زراعي برو (Agri-Pro)

## Objective
Create a short launch-style brag video for زراعي برو (Agri-Pro), a Firebase/React
SaaS for agricultural-equipment contracting companies. Arabic RTL content
throughout — set `dir="rtl"` and use Cairo for all type.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape — 1920x1080
- Duration: ~22.93s

## Source Material
- Project root: `D:\agri-pro\agri-pro`
- Primary files read: `README.md`, `src/pages/LandingPage.jsx` and its section
  components (`Hero.jsx`, `ProblemSection.jsx`, `FeaturesSection.jsx`,
  `DashboardSection.jsx`, `BeforeAfterSection.jsx`), `brand-identity/colors.md`,
  `brand-identity/design-tokens.md`, `tailwind.config.js`
- Product name: زراعي برو (Agri-Pro)
- Tagline / strongest claim: "بيانات أوضح. قرارات أذكى. أرباح أكبر." (hero
  headline). Runner-up line worth considering for the hook: "المشكلة مش إن
  البيانات مش موجودة. المشكلة إنها موجودة... في أماكن كتير."
- Key UI or visual moment to recreate:
  1. The hero's product-truth stat row (`Hero.jsx` `StatCard`s): إيرادات الشغل
     "متصلة بالعميل" / رصيد العهدة "محدّث أول بأول" / حالة المعدات "واضحة
     قدامك" / مستحقات العملاء "بتتحسب لوحدها"
  2. The dashboard stat grid (`DashboardSection.jsx`): الإيرادات "من كل
     الشغلانات" / تكلفة الوقود "لكل شغلانة" / صافي الربح "إيراد ناقص تكلفة" /
     تكلفة الصيانة "لكل معدة" / المرتبات "من ليدجر السواقين" / الضرائب
     والخصومات "سجل مستقل" — six cards, colors green/amber/blue/orange/
     purple/red in that order
  3. The WhatsApp statement feature card (`FeaturesSection.jsx`, badged
     "جديد"): "ابعت كشف حساب على واتساب في ثانية" with chips كشف حساب / تذكير
     بالمستحق / شكر على التعامل / تنبيه غياب
- Copy that must appear verbatim:
  - "بيانات أوضح. قرارات أذكى. أرباح أكبر."
  - "ابعت كشف حساب على واتساب في ثانية"
  - The four hero stat labels and four dashboard-relevant labels listed above
    (exact Arabic strings, not translations/paraphrases)

## Creative Direction
- Tone preset: polished
- Creative direction: a quiet, premium operations-software film — dark navy
  field, restrained neon-green accent, tractor-at-dawn mood echoing the site's
  own hero photography treatment. No jokes, no invented copy — the product's
  own lines and real UI carry the video.
- Interpretation: slow, confident holds rather than fast cuts; one idea per
  scene; calm physics-based motion (chips settling, cards arriving in
  sequence) rather than showy transforms.
- Angle: the product's own landing-page line — "the problem isn't that the
  data doesn't exist, it's that it exists in too many places" — is dramatized
  directly: four scattered, unsettled data sources (WhatsApp / notebook /
  Excel / a person) physically collapse into the product's real, calm,
  organized UI. This *is* the before/after the site describes, staged as one
  continuous motion instead of a static split.
- Hook: four chips (WhatsApp, notebook, Excel, person icon) on a dark field,
  arriving one after another and idling with a slight unresolved jitter — no
  text yet, just visual unease.
- Outro / punchline: "بيانات أوضح. قرارات أذكى. أرباح أكبر." at full scale,
  wordmark/logo settling beneath it, then a held silence.
- Avoid:
  - Generic SaaS language ("streamline your workflow" etc. — not in the
    source copy, don't introduce it)
  - Abstract filler visuals — every scene must show either the chaos chips or
    a real, named piece of product UI
  - Unrelated visual redesign — use the site's actual dark navy / brand-green
    system, not a new palette

## Visual Identity
- Background: `#0a0f1e` (tailwind `dark.DEFAULT`), card/section surfaces
  `#111827` (`surface.DEFAULT`) and `#1a2235` (`surface.2`)
- Text: `#FFFFFF` / light gray (e.g. `text-gray-50`, `text-gray-400` for
  secondary copy) on the dark background
- Accent: primary neon `#8CFF00` used sparingly (one hero highlight max, per
  the project's own brand guideline — never as a background or long text
  run); everyday accent `#22C55E` (tailwind `brand-500`) for success states,
  chart/card accents, and the WhatsApp-bubble green; `#15803D`
  (`brand-700`/dark-green) available for deeper accent needs
- Display font: Cairo, extrabold, for headlines
- Body font: Cairo, regular/medium, for supporting lines and card labels
- Visual references from the project: the neon-green-on-navy `StatCard`
  treatment from `Hero.jsx`/`DashboardSection.jsx`; the rounded-card,
  soft-glow aesthetic described in `brand-identity/design-tokens.md`
  (`radius.lg`–`radius.xl`, `shadow.icon-glow` used very sparingly); the
  WhatsApp-brand green for the message-bubble moment only

## Storyboard
Use the storyboard in `brag-output/brag-plan.md` as the creative contract —
scene boundaries there are already pre-nudged onto this track's strong beat
cues (see Audio below).

Scene summary:
1. Scattered — 3.5s (0–3.5s) — four unsettled chaos chips (WhatsApp/notebook/Excel/person), no text
2. Collapse into product truth — 5.24s (3.5–8.74s) — chips collapse into the real hero stat row; wordmark "زراعي برو" settles above it
3. Live dashboard — 4.37s (8.74–13.11s) — the six real dashboard stat cards arrive in sequence, with the line "بدل ما تجمع الأرقام، خلي الصورة قدامك"
4. Send a statement on WhatsApp — 5.45s (13.11–18.56s) — the "جديد"-badged feature card, headline + four chips populating a WhatsApp-green send bubble
5. Outro — 4.37s (18.56–22.93s) — full-scale hero headline + wordmark, held in silence

## Audio
- Audio role: cinematic support, restrained (polished tone — minimal but present)
- Audio arc: near-silent unease under Scene 1 → one musical swell as the chaos
  resolves into product UI (Scene 2) → steady confident bed through Scenes 3–4
  → fade to near-silence under the Scene 5 hold
- Music: `assets/music/happy-beats-business-moves-vol-12-by-ende-dot-app.mp3`
  (already copied into the composition; "steady and clean" character, suited
  to `polished`/`cinematic`)
- Music treatment: start near-inaudible, swell once at the Scene 1→2
  transition, settle to a steady low bed (~0.3 volume) through Scenes 3–4,
  fade out under Scene 5 rather than cutting
- Music cue guidance: bundled preset at
  `assets/music/cues/happy-beats-business-moves-vol-12-by-ende-dot-app.music-cues.json`
  (and matching `.md`). 109.96 BPM. Strong cues used to set scene boundaries:
  8.74s (Scene 2→3), 13.11s (Scene 3→4), 18.56s (Scene 4→5), 22.93s (final
  headline settle — the highest-intensity cue in the planning window). Treat
  these as targets within ±0.15s, not fixed values — shift for readability if
  needed.
- Audio-reactive treatment: subtle — the green accent glow on the stat/dashboard
  cards may breathe faintly with the music's low end (RMS); no waveform,
  equalizer, or particle visuals
- Audio-coupled moments:
  - Scene 1 — each of the 4 chaos chips arrives with a very soft tick
  - Scene 2 — one low musical swell timed to the chip→card collapse, then a
    soft settle click as each of the 4 hero stat cards locks into place
  - Scene 3 — a quieter settle click per dashboard card (6 cards, 2 rows of 3)
  - Scene 4 — a light tick per WhatsApp chip (4 chips), one soft
    WhatsApp-style send/ping as the bubble departs
  - Scene 5 — no further SFX; let the music fade carry the hold
- SFX selection guidance: polished tone → minimal but present (2-3 subtle
  cues is the target family size, though this storyboard's per-card ticks
  mean several *quiet* instances of 1-2 chosen sounds, not 2-3 total events).
  Favor `interface/drop_001`/`drop_002` or `ui/rollover*` for the soft
  chip/card settle ticks, `interface/bong_001` or `impact/impactSoft_medium_*`
  for the Scene 2 swell payoff, and a light `interface/select_008` or
  `ui/click*` for the WhatsApp chip ticks. Nothing aggressive, no glitch/error
  families (those belong to chaotic/comedic tones, not this one).
- SFX analysis guidance: read `skills/brag/assets/sfx/sfx-analysis.md` (or the
  installed-skill path) before final selection; prefer low/medium
  high-frequency-risk files since several sounds repeat per scene.
- Exact SFX choice: Hyperframes should choose exact filenames, timestamps,
  density, and volume based on the implemented animation timing.
- Audio files: music is already copied to
  `brag-output/composition/assets/music/`. Copy any SFX Hyperframes selects
  into `brag-output/composition/assets/sfx/...` before referencing them.

## Hyperframes Instructions
Load the composition-building Hyperframes domain skills — `hyperframes-core`
(composition contract + `data-*` timing), `hyperframes-animation` (motion),
`hyperframes-creative` (design spec, beats, audio-reactive),
`hyperframes-keyframes` (seek-safe keyframes), and `hyperframes-cli`
(lint/check/render). `/brag` is its own workflow: do not enter the
`hyperframes` entry-point intent interview and do not route into its generic
promo / launch-video workflow. Prefer native Hyperframes conventions over
anything in `/brag`.

Requirements:
- Show at least one real UI, copy, or visual element from the source project
  (this brief specifies three: the hero stat row, the dashboard stat grid,
  and the WhatsApp feature card — use all three as the centerpiece scenes).
- Keep all text readable in the final render — Arabic RTL, Cairo font, apply
  the reading-time floor from the brag-plan (short label ≈0.8s settled,
  full line ≈0.3s/word).
- Keep the video within 15-25 seconds (target ~22.93s per the storyboard).
- Include the planned music/SFX layer — audio was not disabled and silence is
  not the creative choice here.
- Treat `/brag` audio notes as guidance, not a fixed cue sheet. Choose exact
  SFX after the visual animation exists.
- Treat the music cue metadata above as optional timing hints. Ignore any cue
  that hurts readability, scene pacing, or the product story.
- Major reveals may move toward nearby strong cues within ~0.15s. Smaller
  entrances may align to nearby beat points within ~0.10s. Use only the 1-3
  strong cue locks already identified (Scene boundaries above) unless the
  edit clearly benefits from more.
- Use SFX to support motion and interaction per the guidance above; keep
  overall density sparse per the `polished` energy tier.
- Honor the planned music treatment: near-silent start, one swell, steady bed,
  fade (not cut) under the outro.
- Wire at least one visual element to audio-reactive RMS/frequency data per
  the `hyperframes-creative` audio-reactive workflow (subtle glow/presence on
  the stat cards). If extraction is unavailable, document that and skip
  audio-reactive rather than blocking the render.
- Use local assets (music already in `composition/assets/music/`) for audio
  and any required runtime/media dependencies.
- Run `hyperframes check` before render — it is brag's single gate.
