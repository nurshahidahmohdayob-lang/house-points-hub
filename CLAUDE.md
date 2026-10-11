# Class Points Hub

Static site (index.html, style.css, app.js) — no build step. Pushing to `main` auto-deploys to
https://lifecomp.vercel.app (also https://house-points-hub.vercel.app; Vercel project `house-points-hub`, team scope `zera-education-suite-s-projects`).

## 3D design workflow (always use Blender)
Any 3D look in the app (jars, lids, stars, trophies, new props) is **modelled and rendered in Blender**, not drawn in CSS/SVG.

1. Edit `blender/build_assets.py` (geometry, materials, lights, camera, "Design knobs" at the top).
2. Render: `blender -b --python blender/build_assets.py` → writes transparent PNGs into `assets/` and saves `blender/assets.blend`.
3. If framing changes, re-measure the alpha bounding boxes and update the matching numbers:
   - `JAR` constants in `app.js` (star area), `.jar-stars` box and `.jar-lid` transform-origin in `style.css`.
   - Jar and lid renders share one 150x212 CSS box (rendered at 2x = 300x424).
4. Check it in headless Chrome, then commit + push (deploys automatically).

The live Blender app can also be driven through the MCP-for-Blender add-on (localhost:9876) for interactive design;
final assets must still come from `build_assets.py` so they can be regenerated.

Current style: **kawaii jars, 3D cartoon** (EEVEE toon shading + thick Freestyle outlines). `SHAPES` in build_assets.py
defines each jar shape (clip, round/cookie, tall, mason); every shape renders to `assets/jars/<shape>/`
(`jar.png` → stars → `front.png` → `eyes-open|closed|happy.png` → lid `lid.png` tinted + `extra.png` untinted), and
Blender writes `assets/jars/shapes.js` with each shape's measured star area and lid hinge — app.js reads it, so new
shapes need no hand-tuned CSS. Teachers pick name / emoji / colour / shape per group in the ✏️ jar editor.
When editing static files, bump the `?v=` on style.css / app.js / shapes.js in index.html.

Group colours are applied in CSS by tinting the white lid render (`.lid-tint`) and the glass (`.jar-tint`), multiply blend — render lids white.

## Life Competencies lessons (📚 Lessons tab)
- Content is NOT hand-written here. **Manual sync only** (user's choice — no automatic downloads, to save data):
  the Lessons tab uses the built-in copy `assets/lc-data.js` until the teacher taps **🔄 Sync with Life Competencies**,
  which downloads https://zera-life-competencies.vercel.app/class-points/lc-data.js (published by the LC app's
  `prebuild`: scripts/class-points-data.mjs + class-points-entry.ts in digital-literacy) and keeps it on the device in
  Cache Storage. Keep the exported names in class-points-entry.ts stable (lessons.js checks them: `NEEDS`).
- Refresh the built-in copy with `cd lc && npm install && node build.mjs` (reads `~/Codes/digital-literacy/src/lib`,
  override `LC_SRC`). The bundle declares a global `var LC`, so reset it with `window.LC = undefined`, never `delete`.
- `lessons.js` / `lessons.css` build the picker (Year → Term → Week), the teaching slides (port of the LC app's
  `buildWeekSlides` order + interactive widgets), mind map, Team Quiz, Puzzle games (buildLesson question kinds),
  and the LC board game / Block Run in an iframe. Stars go to the jars via `window.ClassPoints` (defined in app.js).
- Test harness: `_test.html` + `_test.js` (git-ignored) drive the UI headlessly.
- 📱 Live play: `live.js` (RPC client + teacher board) and `play.html` (student devices) use the Life Competencies
  app's Supabase Live Class RPCs (live_open/control/join/submit/state, polled ~0.9s). `live-config.js` holds the
  public anon URL/key (same as the LC app's browser bundle) — never put a service-role key here. Opening a game
  needs the school's teacher key (typed by the teacher, kept only in sessionStorage). Right answers give the
  matching Class Points student +1 (matched by name), so their group jar fills too.
- Old address house-points-hub.vercel.app now forwards to lifecomp.vercel.app via move.js (carries localStorage in the URL hash; new side imports, asks before overwriting different data).
- 📄 My activities (`activity.js`, card on each lesson week): teacher uploads a worksheet (.html/.txt or pasted text);
  `parse()` finds numbered questions, a)/b) options, ____ blanks, (True/False), 2-column tables (matching), form controls,
  and answers (Answer: lines, Answer key heading, ✓ or bold option). Teacher confirms answers, then Play (iframe with
  self-checking page from `buildHtml()`), Live play (MCQ/TF only), or Download a standalone student HTML. Saved in
  localStorage `class-points-activities-v1`.
- ▶️ Teach the lesson = `teachMap` (lessons.js): a two-sided mind map / graphical notes that grows one branch per
  Next (→/Space, O = whole map, drag + wheel to pan/zoom). `mapBranches` builds branches from the same LC data as the
  slides; every branch carries a ❓ question node (quick-check MCQ, think & share with timer, or match/order/sort
  puzzle) that opens in a pop-up and counts toward the ❓ score. The classic deck is still there as 📑 Slides (`teach`).
- 📲 Students' devices (activity.js `assign`/`results` + `do.html`): reuses the LC app's online-lesson hand-in RPCs
  (mint_lesson with plan_id `cp-act-<id>`, week 1 → token; submit_lesson per answer with all answers so far;
  lesson_submissions_for polled every 2.5s by the board). The activity travels in the link hash
  (`do.html#<token>~<gzip base64url>`, data: images replaced by `{kind:"skip"}` so item indices match the board).
  Live game (live.js) also accepts typed questions (`kind:"type"`, word wall) and unkeyed ones (polls).
