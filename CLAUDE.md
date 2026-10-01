# Class Points Hub

Static site (index.html, style.css, app.js) — no build step. Pushing to `main` auto-deploys to
https://house-points-hub.vercel.app (Vercel team scope `zera-education-suite-s-projects`).

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

Current style: **kawaii clip-top jar, 3D cartoon** (EEVEE toon shading + thick Freestyle outlines), based on the user's
reference picture. Layers in the .jar box: `jar.png` (cream glass + lip, behind stars) → stars (`star-0..5.png`, 6 colours)
→ `jar-front.png` (brows, mouth, cheeks + shine) → eyes (`eyes-open|closed|happy.png`, swapped by JS to blink / smile) → lid (`lid.png` tinted + `lid-clasp.png` untinted, rotate together).
When editing static files, bump the `?v=` on style.css/app.js in index.html. The photoreal Cycles version is kept in
`blender/build_assets_realistic.py`.

Group colours are applied in CSS by tinting the white lid render (`.lid-tint`) and the glass (`.jar-tint`), multiply blend — render lids white.
