# Brag Plan: زراعي برو (Agri-Pro)

## What is this app?
A Firebase/React SaaS for agricultural-equipment contracting companies that pulls
equipment, jobs, drivers, payroll, cash custody, maintenance, and client debt
into one connected, offline-capable, Arabic-RTL system — replacing the WhatsApp
threads, paper notebooks, and scattered Excel files the business actually runs on
today.

## The angle
The product's own landing page already nails the premise better than any invented
joke would: **"المشكلة مش إن البيانات مش موجودة. المشكلة إنها موجودة... في أماكن
كتير."** ("The problem isn't that the data doesn't exist. The problem is it exists
— in too many places.") The video dramatizes exactly that collapse: scattered,
noisy sources of truth (WhatsApp bubble, notebook, Excel grid, a person) crush
inward into one calm, dark, neon-green-accented system. No invented humor — the
real contrast between chaos and the product's actual UI carries the whole video.

## Hook (first 2-3 seconds)
Four scattered chips — WhatsApp, a notebook, an Excel file, a person icon — drift
independently on a dark field, unsettled, slightly jittering, like open tabs no
one closed. No headline text yet, just the visual unease of "everything, nowhere."

## Key moments (the middle)
- The scattered chips from the hook physically collapse/snap together into the
  product's real hero stat row (revenue tied to client, custody balance,
  equipment status, client dues) — the literal "before → after" the landing page
  describes, staged as one continuous motion rather than a before/after split.
- The real dashboard stat grid (`DashboardSection`) arriving card by card:
  الإيرادات، تكلفة الوقود، صافي الربح، تكلفة الصيانة، المرتبات، الضرائب
  والخصومات — same six labels, same order, same accent colors as the product.
- The WhatsApp statement feature (`FeaturesSection`, badged "جديد"): the line
  "ابعت كشف حساب على واتساب في ثانية" with its real chip set (كشف حساب / تذكير
  بالمستحق / شكر على التعامل / تنبيه غياب) populating one by one into a WhatsApp-
  green send bubble.

## Outro / punchline
The hero headline, full-scale, in the product's own words — no invented tagline:
**"بيانات أوضح. قرارات أذكى. أرباح أكبر."** — then the wordmark/logo settles under
it and the frame holds in silence.

## User flow worth showing
none — landing-page only (this is a private, authenticated back-office app;
there is no public demo flow to recreate beyond the marketing page's own
product-truth material, which already mirrors real screens: the hero stat row
and the dashboard stat grid are literal reproductions of in-app components, not
invented mockups).

## Tone
- Preset: polished
- Creative direction: a quiet, premium operations-software film — dark navy
  field, restrained neon-green accent used the way the brand guide insists
  (sparingly, on the thing that matters), tractor-at-dawn mood from the site's
  own hero photography treatment.
- Interpretation: slow, confident holds (not fast cuts); one idea per scene;
  the product's own copy carries the video with no jokes added; motion is calm
  and physics-based (chips settling, cards arriving) rather than showy.

## Format: landscape — 1920x1080
## Duration: ~22.93s

## Visual identity (from the project)
- Background: `#0a0f1e` (dark) / darker surface `#111827`, `#1a2235` (brand tailwind `dark` / `surface` / `surface-2`)
- Accent (primary, sparing use only — CTAs/highlights): `#8CFF00`
- Accent (everyday — success states, charts, badges): `#22C55E` (tailwind `brand-500`)
- Dark-green accent (text on light surfaces): `#15803D`
- Text: `#FFFFFF` / light gray on dark background
- Display font: Cairo (extrabold for headlines)
- Body font: Cairo (regular/medium)
- Strongest visual element: scattered chaos icons collapsing into the real
  neon-green-on-navy stat cards — the site's own before/after idea, staged as
  one motion instead of a static split.

## Share copy (draft)
بيانات أوضح، قرارات أذكى، أرباح أكبر — زراعي برو بيجمع شغلك ومعداتك وسواقينك
وفلوسك في مكان واحد، بدل ما تدوّر عليهم في الواتساب والدفاتر.

## Audio direction
- Role: cinematic support, restrained
- Music: a low, warm cinematic/corporate bed — subdued strings or soft synth pad, no percussion-forward track
- Music treatment: starts almost inaudible under the scattered-chip unease, swells gently as the chips collapse into the stat row, sustains under the two highlight scenes, fades under the outro hold rather than cutting
- Music cue guidance: bundled preset selected — `happy-beats-business-moves-vol-12-by-ende-dot-app` (109.96 BPM, steady/clean character fits `polished`). Scene boundaries below are pre-nudged onto its `strongCues`: 8.74s (Scene 2→3, dashboard reveal), 13.11s (Scene 3→4, WhatsApp reveal), 18.56s (Scene 4→5, outro), 22.93s (final headline settle). No dense beat-grid needed given the low scene count and generous holds — Hyperframes may fine-tune ±0.15s per the standard cue-lock tolerance.
- Audio-reactive treatment: subtle — the green accent glow on the stat cards may breathe faintly with the music's low end; never waveform bars or anything overt
- SFX posture: sparse, motion-matched, professional restraint
- Audio-coupled moments: each stat/dashboard card gets one soft, low "settle" click as it arrives; the WhatsApp chips get a single light "message" tick on their first arrival, and a soft WhatsApp-style send/ping on the bubble's final state
- Restraint rule: no chimes, no swooshes, no upbeat "SaaS demo" stingers, nothing playful — the audio should feel like a serious operations tool, not a consumer app

## Storyboard

### Scene 1 — Scattered — 3.5s (0-3.5s)
Dark navy field (`#0a0f1e`). Four chips (WhatsApp icon, notebook icon, Excel
icon, a person icon) sit at uneven positions, each drifting/jittering slightly
as if unresolved. No text — the unease is the point.
Sequential/interaction: yes — the four chips fade/settle in one after another (not simultaneous), ~0.25s apart, then continue a slow idle jitter until the scene ends.
Audio intent: quiet unease, low sustained tone, almost nothing
Audio-coupled idea: a very soft tick as each chip arrives
Music: barely-there low pad, just establishing presence
Transition mood: dramatic (a hard inward pull) → Scene 2

### Scene 2 — Collapse into product truth — 5.24s (3.5-8.74s)
The four scattered chips are pulled inward and resolve into the product's real
hero stat row: إيرادات الشغل (متصلة بالعميل) / رصيد العهدة (محدّث أول بأول) /
حالة المعدات (واضحة قدامك) / مستحقات العملاء (بتتحسب لوحدها) — same four
labels/values as `Hero.jsx`'s StatCard row, on the same dark background with the
brand-500 green accent. The wordmark "زراعي برو" settles in above the row.
Sequential/interaction: yes — the chip-to-card collapse is one continuous motion; each of the four stat cards locks into place in sequence, ~0.4s apart, each landing on its own low click.
Audio intent: release/resolution — the unease from Scene 1 resolves into calm confidence
Audio-coupled idea: a single low musical swell timed to the collapse, then each card's settle click; scene end at 8.74s is beat-locked to the track's strong cue (1.00, strong_beat) for the dashboard reveal payoff
Music: swell begins, then settles into a steady low bed
Transition mood: soft crossfade, landing on the beat → Scene 3

### Scene 3 — Live dashboard — 4.37s (8.74-13.11s)
The product's real dashboard stat grid (`DashboardSection.jsx`): six cards —
الإيرادات (من كل الشغلانات) / تكلفة الوقود (لكل شغلانة) / صافي الربح (إيراد
ناقص تكلفة) / تكلفة الصيانة (لكل معدة) / المرتبات (من ليدجر السواقين) /
الضرائب والخصومات (سجل مستقل) — inside one card container matching the site's
`Card` styling. Small supporting line above: "بدل ما تجمع الأرقام، خلي الصورة
قدامك."
Sequential/interaction: yes — six cards arrive in two rows of three, left-to-right, ~0.3s apart, each with its own accent color (green/amber/blue/orange/purple/red) matching the real component.
Audio intent: steady competence — this is the product working, not a reveal
Audio-coupled idea: low settle click per card, quieter than Scene 2's; scene end at 13.11s is beat-locked to a strong cue (0.98, strong_beat)
Music: steady bed, no swell
Transition mood: clean crossfade, landing on the beat → Scene 4

### Scene 4 — Send a statement on WhatsApp — 5.45s (13.11-18.56s)
The "جديد" (New) feature card from `FeaturesSection.jsx`: headline "ابعت كشف
حساب على واتساب في ثانية" with its real supporting line, then its four chips
(كشف حساب / تذكير بالمستحق / شكر على التعامل / تنبيه غياب) populate one by one
into a WhatsApp-green message bubble that visibly sends.
Sequential/interaction: yes — the four chips appear one at a time inside the bubble, ~0.35s apart, then the bubble does a small send/depart motion.
Audio intent: a small moment of delight, still restrained — this is the video's one "featured" beat
Audio-coupled idea: light tick per chip; one soft WhatsApp-style send ping on the bubble's departure; scene end at 18.56s is beat-locked to a strong cue (0.99, strong_beat)
Music: steady bed continues
Transition mood: soft crossfade, landing on the beat → Scene 5

### Scene 5 — Outro — 4.37s (18.56-22.93s)
Full-scale headline in the product's own words: "بيانات أوضح. قرارات أذكى.
أرباح أكبر." The زراعي برو wordmark/logo settles beneath it. Frame holds.
Sequential/interaction: none — one settled composition, no further motion beyond the initial settle
Audio intent: quiet confidence, resolution
Audio-coupled idea: the headline/wordmark settle is beat-locked to the track's strongest cue in-window (22.93s, 1.00, strong_beat); no further audio-coupled motion after that
Music: gentle fade to silence under the hold
Transition mood: — (final scene)

**Music mood for this video:** cinematic, restrained, low-key corporate
**Audio summary:** Starts almost silent under visual unease, swells once as chaos resolves into the product's real UI, holds steady and confident through both feature highlights, and fades to quiet under the final headline — never loud, never playful, always in service of a serious operations tool.
