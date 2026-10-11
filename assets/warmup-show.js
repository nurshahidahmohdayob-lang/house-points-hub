// What the class needs to SEE for warm-ups that say "Show two versions…", "Hold up a clock…", "Show an advert…".
// Keyed "<planId>-<week>"; shown under the warm-up question (mind map pop-up, Do now slide, lesson page).
// Built from small pieces (cards, chat bubbles, email, headline, advert) styled by .ws-* in lessons.css.
(function () {
  const card = (e, t, s) => `<div class="ws-card"><span class="ws-e">${e}</span><b>${t}</b>${s ? `<small>${s}</small>` : ""}</div>`;
  const cards = (...c) => `<div class="ws-cards">${c.join("")}</div>`;
  const label = (t) => `<div class="ws-label">${t}</div>`;
  const pair = (a, b) => `<div class="ws-pair"><div>${a}</div><div>${b}</div></div>`;
  const chat = (from, lines) => `<div class="ws-phone"><div class="ws-chathead">💬 ${from}</div>${lines.map((l) => `<div class="ws-bubble">${l}</div>`).join("")}</div>`;
  const email = (to, subject, body) => `<div class="ws-email"><div class="ws-row"><b>To:</b> ${to}</div><div class="ws-row"><b>Subject:</b> ${subject}</div><div class="ws-body">${body}</div></div>`;
  const headline = (kicker, h, sub, foot) => `<div class="ws-news"><div class="ws-kicker">${kicker}</div><h3>${h}</h3>${sub ? `<p>${sub}</p>` : ""}${foot ? `<div class="ws-foot">${foot}</div>` : ""}</div>`;
  const speech = (who, e, t) => `<div class="ws-say"><span class="ws-e">${e}</span><div><b>${who}</b><p>${t}</p></div></div>`;
  const clock = (h, m) => {
    const ha = ((h % 12) + m / 60) * 30, ma = m * 6;
    const ticks = Array.from({ length: 12 }, (_, i) => { const a = (i + 1) * 30 * Math.PI / 180; return `<text x="${100 + 72 * Math.sin(a)}" y="${100 - 72 * Math.cos(a) + 7}" text-anchor="middle" font-size="20" font-weight="800" fill="#241c3d">${i + 1}</text>`; }).join("");
    return `<svg class="ws-clock" viewBox="0 0 200 200" role="img" aria-label="A clock showing ${h}:${String(m).padStart(2, "0")}"><circle cx="100" cy="100" r="94" fill="#fff" stroke="#6b4dff" stroke-width="8"/>${ticks}
      <line x1="100" y1="100" x2="${100 + 42 * Math.sin(ha * Math.PI / 180)}" y2="${100 - 42 * Math.cos(ha * Math.PI / 180)}" stroke="#241c3d" stroke-width="9" stroke-linecap="round"/>
      <line x1="100" y1="100" x2="${100 + 64 * Math.sin(ma * Math.PI / 180)}" y2="${100 - 64 * Math.cos(ma * Math.PI / 180)}" stroke="#e5484d" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="100" r="7" fill="#241c3d"/></svg>`;
  };

  window.WARMUP_SHOW = {
    /* Year 1 */
    "y1-t1-2": cards(card("😀", "Happy"), card("😢", "Sad"), card("😠", "Cross"), card("😲", "Surprised")),
    "y1-t3-3": cards(card("🧴", "Plastic bottle"), card("🍌", "Banana skin"), card("📄", "Piece of paper")) + label("Which bin?") + cards(card("♻️", "Recycling"), card("🍂", "Food waste"), card("📦", "Paper")),
    "y1-t3-7": pair(card("🥀", "Plant A", "Droopy leaves · brown edges · dry soil"), card("🪴", "Plant B", "Green leaves · standing tall · damp soil")),
    /* Year 2 */
    "y2-t1-4": `<div class="ws-center">${clock(7, 30)}</div>`,
    "y2-t2-3": cards(card("🩺", "Stethoscope"), card("🪥", "Toothbrush"), card("🩹", "Plaster")) + label("Who uses it?") + cards(card("👩‍⚕️", "Doctor"), card("🦷", "Dentist"), card("🧑‍⚕️", "Nurse")),
    "y2-t2-7": cards(card("🍚", "Rice"), card("🥚", "Egg"), card("🥛", "Milk")),
    "y2-t3-1": cards(card("✏️", "Pencil sharpener", "Put a blunt pencil in, turn it… sharp!")),
    "y2-t3-8": cards(card("✂️", "Scissors"), card(`<svg viewBox="0 0 120 70" width="96" height="56" aria-hidden="true"><polygon points="5,65 115,65 115,10" fill="#ffb020" stroke="#241c3d" stroke-width="3"/><rect x="58" y="24" width="22" height="22" fill="#6b4dff" transform="rotate(-26 69 35)"/></svg>`, "Ramp")),
    /* Year 3 */
    "y3-t2-8": pair(card("🌳🐦💧🌸🦋", "Photo 1", "Clear river · tall trees · birds and flowers"), card("🪵🗑️🛢️💨🥤", "Photo 2", "Same place: tree stumps · rubbish · oily water · smoke")),
    "y3-t3-1": cards(card("🫗", "Water bottle with a flip lid"), card("🎒", "School bag"), card("🪑", "Classroom chair")) + label("Pick one: who designed it, and what were they trying to solve?"),
    /* Year 4 */
    "y4-t1-6": `<div class="ws-center"><div class="ws-fabric" role="img" aria-label="A patterned fabric"></div></div>`,
    "y4-t1-8": cards(card("🎵", "Play 30 seconds of traditional music", `Try one: <a href="https://www.youtube.com/results?search_query=gamelan+music" target="_blank" rel="noopener">gamelan</a> · <a href="https://www.youtube.com/results?search_query=sitar+music" target="_blank" rel="noopener">sitar</a> · <a href="https://www.youtube.com/results?search_query=erhu+music" target="_blank" rel="noopener">erhu</a> · <a href="https://www.youtube.com/results?search_query=djembe+drumming" target="_blank" rel="noopener">djembe</a>`)),
    /* Year 5 */
    "y5-t1-6": pair(
      label("Version A") + chat("To: Ms Tan", ["hey cikgu 👋", "cant come tmr sick lol 🤒", "wat hw?? thx"]),
      label("Version B") + email("Ms Tan", "Absent tomorrow – homework", "Dear Ms Tan,<br><br>I am unwell and will not be able to come to school tomorrow. Could you please tell me what homework I need to complete?<br><br>Thank you.<br>Kind regards,<br>Aisyah (5 Bestari)")),
    "y5-t1-8": headline("BREAKING", "SCIENTISTS SAY CHOCOLATE MAKES YOU SMARTER!", "Eat a bar every day and your test scores will go up, experts say.", "No author · no date · no website name"),
    "y5-t1-9": chat("Message from Daniel", ["Wow, great job on the poster. 🙂"]) + label("Is Daniel being kind… or sarcastic? Write a reply that avoids a row."),
    "y5-t2-5": pair(speech("Amir says", "🙋‍♂️", "“Ben pushed me in the lunch queue! I nearly dropped my tray.”"), speech("Ben says", "🙋", "“Someone bumped into me from behind and I fell into Amir. I didn't mean it!”")),
    "y5-t2-7": `<div class="ws-problem">😩 “Our class takes ten minutes to settle after every break — people are still drinking water, looking for their books, finishing games and chatting about what happened outside.”</div>`,
    "y5-t2-9": `<div class="ws-ad"><div class="ws-adtop">⚡ NEW ⚡</div><div class="ws-e">👟</div><h3>ZOOM Sneakers</h3><p><b>Be the fastest in your class!</b></p><p>9 out of 10 kids love them!*</p><p>Everyone's wearing them — don't be left behind.</p><small>*We asked 10 kids.</small></div>`,
    /* Year 6 */
    "y6-t1-7": headline("WORLD NEWS", "WORLD LEADERS AGREE NEW PLAN TO CUT PLASTIC IN THE OCEANS", "“This is a great day for our planet,” said the presidents and prime ministers who signed the plan in Geneva.", "Quotes from: presidents and prime ministers only"),
    "y6-t1-9": label("The rule: “Everyone must be in the hall within 2 minutes of the bell.”") + pair(card("🏃‍♀️", "Scenario A", "Sara's class is next to the hall. She walks there in 1 minute — on time."), card("🧑‍🦽", "Scenario B", "Danial uses a wheelchair. The lift is broken, so he must go the long way round. He arrives after 5 minutes — and is marked late.")),
  };
})();
