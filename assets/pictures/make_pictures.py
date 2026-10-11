# Flat, kid-friendly illustrations for warm-ups that say "Show a picture of ..."
import math
import os; OUT = os.path.dirname(os.path.abspath(__file__)) + "/"
W, H = 1200, 750

def kid(x, y, s=1, skin="#f2c49b", hair="#3b2416", shirt="#3b82f6", pants="#1e3a8a", pose="stand", face="happy", flip=False, hairstyle="short"):
    """A simple rounded child figure; (x, y) = feet on the ground."""
    g = [f'<g transform="translate({x},{y}) scale({-s if flip else s},{s})">']
    if pose == "stand":
        g.append(f'<rect x="-16" y="-70" width="13" height="70" rx="6" fill="{pants}"/><rect x="3" y="-70" width="13" height="70" rx="6" fill="{pants}"/>')
        g.append(f'<ellipse cx="-10" cy="-2" rx="11" ry="6" fill="#222"/><ellipse cx="10" cy="-2" rx="11" ry="6" fill="#222"/>')
        g.append(f'<rect x="-24" y="-140" width="48" height="78" rx="20" fill="{shirt}"/>')
        g.append(f'<path d="M-20 -128 Q-44 -100 -40 -76" stroke="{shirt}" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="-40" cy="-74" r="7" fill="{skin}"/>')
        g.append(f'<path d="M20 -128 Q46 -150 52 -176" stroke="{shirt}" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="53" cy="-180" r="7" fill="{skin}"/>')
        hy = -170
    elif pose == "run":
        g.append(f'<path d="M-6 -66 L-30 -30 L-22 0" stroke="{pants}" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 -66 L22 -34 L44 -40" stroke="{pants}" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
        g.append(f'<ellipse cx="-20" cy="0" rx="11" ry="6" fill="#222"/><ellipse cx="50" cy="-40" rx="10" ry="6" fill="#222"/>')
        g.append(f'<rect x="-22" y="-140" width="46" height="78" rx="20" fill="{shirt}" transform="rotate(8)"/>')
        g.append(f'<path d="M-16 -126 L-46 -104" stroke="{shirt}" stroke-width="13" stroke-linecap="round"/><circle cx="-49" cy="-102" r="7" fill="{skin}"/>')
        g.append(f'<path d="M22 -124 L50 -150" stroke="{shirt}" stroke-width="13" stroke-linecap="round"/><circle cx="53" cy="-153" r="7" fill="{skin}"/>')
        hy = -168
    else:  # sit hugging knees
        g.append(f'<path d="M-14 -40 L22 -40 L22 -2" stroke="{pants}" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
        g.append(f'<path d="M-14 -46 L26 -64 L24 -4" stroke="{pants}" stroke-width="15" fill="none" stroke-linecap="round" stroke-linejoin="round"/>')
        g.append(f'<ellipse cx="28" cy="0" rx="11" ry="6" fill="#222"/>')
        g.append(f'<rect x="-30" y="-112" width="42" height="74" rx="18" fill="{shirt}" transform="rotate(14 -10 -60)"/>')
        g.append(f'<path d="M-2 -96 Q24 -88 30 -66" stroke="{shirt}" stroke-width="13" fill="none" stroke-linecap="round"/><circle cx="30" cy="-64" r="7" fill="{skin}"/>')
        hy = -128
    # head
    hx = 6 if pose == "sit" else 0
    g.append(f'<circle cx="{hx}" cy="{hy}" r="27" fill="{skin}"/>')
    if hairstyle == "long":
        g.append(f'<path d="M{hx-29} {hy+18} Q{hx-34} {hy-34} {hx} {hy-31} Q{hx+34} {hy-34} {hx+29} {hy+18} L{hx+22} {hy-6} Q{hx} {hy-22} {hx-22} {hy-6} Z" fill="{hair}"/>')
    else:
        g.append(f'<path d="M{hx-27} {hy-2} Q{hx-30} {hy-34} {hx} {hy-31} Q{hx+30} {hy-32} {hx+27} {hy-4} Q{hx+10} {hy-20} {hx-27} {hy-2} Z" fill="{hair}"/>')
    ey = hy + (6 if face == "sad" else 2)
    g.append(f'<circle cx="{hx-9}" cy="{ey}" r="3.2" fill="#222"/><circle cx="{hx+9}" cy="{ey}" r="3.2" fill="#222"/>')
    if face == "happy":
        g.append(f'<path d="M{hx-9} {hy+12} Q{hx} {hy+21} {hx+9} {hy+12}" stroke="#7a2e1a" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="{hx-16}" cy="{hy+10}" r="4" fill="#f59e9e" opacity=".7"/><circle cx="{hx+16}" cy="{hy+10}" r="4" fill="#f59e9e" opacity=".7"/>')
    elif face == "sad":
        g.append(f'<path d="M{hx-7} {hy+19} Q{hx} {hy+13} {hx+7} {hy+19}" stroke="#7a2e1a" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M{hx-14} {hy} L{hx-5} {hy-5}" stroke="#3b2416" stroke-width="2.5" stroke-linecap="round"/><path d="M{hx+14} {hy} L{hx+5} {hy-5}" stroke="#3b2416" stroke-width="2.5" stroke-linecap="round"/><path d="M{hx+14} {ey+8} q-3 7 0 10 q3 -3 0 -10z" fill="#60a5fa"/>')
    elif face == "o":
        g.append(f'<ellipse cx="{hx}" cy="{hy+15}" rx="4" ry="5" fill="#7a2e1a"/>')
    else:
        g.append(f'<path d="M{hx-7} {hy+15} L{hx+7} {hy+15}" stroke="#7a2e1a" stroke-width="3" stroke-linecap="round"/>')
    g.append('</g>')
    return "".join(g)

def tree(x, y, s=1):
    return (f'<g transform="translate({x},{y}) scale({s})"><rect x="-14" y="-150" width="28" height="150" rx="8" fill="#8b5a2b"/>'
            f'<circle cx="0" cy="-190" r="80" fill="#3f9d4b"/><circle cx="-60" cy="-150" r="55" fill="#4caf50"/><circle cx="60" cy="-155" r="58" fill="#43a047"/><circle cx="10" cy="-240" r="50" fill="#66bb6a"/></g>')

def sky(extra=""):
    return (f'<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fd3ff"/><stop offset="1" stop-color="#dff4ff"/></linearGradient></defs>'
            f'<rect width="{W}" height="{H}" fill="url(#sky)"/><circle cx="1060" cy="110" r="55" fill="#ffd84d"/>'
            f'<g fill="#fff" opacity=".9"><ellipse cx="220" cy="110" rx="80" ry="28"/><ellipse cx="270" cy="95" rx="55" ry="30"/><ellipse cx="700" cy="80" rx="70" ry="24"/><ellipse cx="745" cy="68" rx="45" ry="24"/></g>{extra}')

def ground(color="#7cc96b", y=470):
    return f'<rect y="{y}" width="{W}" height="{H-y}" fill="{color}"/><path d="M0 {y} Q300 {y-20} 600 {y} T1200 {y}" fill="{color}"/>'

def slide(x, y):
    return (f'<g transform="translate({x},{y})"><rect x="0" y="-230" width="12" height="230" fill="#ef4444"/><rect x="70" y="-230" width="12" height="230" fill="#ef4444"/>'
            + "".join(f'<rect x="0" y="{-30-i*40}" width="82" height="9" fill="#b91c1c"/>' for i in range(5))
            + f'<rect x="-6" y="-240" width="96" height="16" rx="6" fill="#f97316"/><path d="M82 -232 Q180 -150 250 -10 L250 0 L228 0 Q170 -130 82 -206 Z" fill="#facc15"/></g>')

def swing(x, y):
    return (f'<g transform="translate({x},{y})"><path d="M0 0 L40 -230 L80 0 M220 0 L260 -230 L300 0" stroke="#2563eb" stroke-width="12" fill="none" stroke-linejoin="round"/>'
            f'<rect x="30" y="-240" width="240" height="14" rx="7" fill="#1d4ed8"/><path d="M110 -226 L110 -70 M160 -226 L160 -70" stroke="#555" stroke-width="3"/><rect x="100" y="-72" width="70" height="12" rx="5" fill="#a855f7"/></g>')

def fence(x1, x2, y):
    posts = "".join(f'<rect x="{x}" y="{y-110}" width="16" height="110" rx="4" fill="#e7d4b5" stroke="#c4a77d" stroke-width="2"/>' for x in range(x1, x2, 46))
    return f'<rect x="{x1}" y="{y-85}" width="{x2-x1}" height="12" fill="#d9c09a"/><rect x="{x1}" y="{y-40}" width="{x2-x1}" height="12" fill="#d9c09a"/>{posts}'

def svg(body, title):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="{title}"><title>{title}</title>{body}</svg>'

# 1 — a child sitting alone at the edge of the playground
b = sky() + ground() + '<rect x="140" y="520" width="640" height="190" rx="90" fill="#e8c38f" opacity=".75"/>'
b += tree(1080, 520, .95) + slide(170, 600) + swing(480, 560)
b += kid(330, 650, 1, shirt="#ef4444", pants="#374151", pose="run", hair="#111") + kid(430, 640, .95, skin="#c68642", shirt="#22c55e", pants="#1f2937", pose="stand", hairstyle="long", hair="#1b1b1b")
b += kid(700, 655, 1, skin="#e0ac69", shirt="#f59e0b", pants="#1e40af", pose="run", flip=True)
b += '<g transform="translate(560 450)"><circle r="20" fill="#fff"/><path d="M-20 0 A20 20 0 0 0 20 0" fill="#3b82f6"/></g>'
b += fence(860, 1200, 640)
b += '<g transform="translate(905 640)"><rect x="0" y="-60" width="190" height="16" rx="6" fill="#a16207"/><rect x="0" y="-92" width="190" height="14" rx="6" fill="#ca8a04"/><rect x="14" y="-46" width="12" height="46" fill="#713f12"/><rect x="164" y="-46" width="12" height="46" fill="#713f12"/></g>'
b += kid(990, 620, 1, skin="#f1c27d", shirt="#64748b", pants="#334155", pose="sit", face="sad", hair="#5b3a1e")
open(OUT + "y1-t1-3.svg", "w").write(svg(b, "A child sitting alone on a bench at the edge of the playground while other children play together"))

# 2 — litter in a playground
b = sky() + ground("#86cf72") + '<rect x="80" y="520" width="1040" height="200" rx="100" fill="#e8c38f" opacity=".75"/>'
b += tree(110, 500, .8) + slide(260, 610) + swing(640, 580)
bin_ = '<g transform="translate(980 640)"><rect x="-55" y="-150" width="110" height="150" rx="10" fill="#16a34a"/><rect x="-62" y="-162" width="124" height="20" rx="8" fill="#15803d"/><text x="0" y="-60" text-anchor="middle" font-size="44">♻️</text></g>'
b += bin_
litter = [
  '<g transform="translate(980 470) rotate(-10)"><path d="M-40 10 Q-30 -30 0 -20 Q30 -40 45 5 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="3"/><rect x="-20" y="-40" width="26" height="40" rx="5" fill="#ef4444" transform="rotate(25)"/></g>',
  '<g transform="translate(420 655) rotate(70)"><rect x="-12" y="-24" width="24" height="48" rx="6" fill="#dc2626"/><rect x="-12" y="-14" width="24" height="10" fill="#fca5a5"/></g>',
  '<g transform="translate(560 690) rotate(-20)"><rect x="-38" y="-14" width="76" height="28" rx="6" fill="#f59e0b"/><text x="0" y="7" text-anchor="middle" font-size="16" font-weight="bold" fill="#7c2d12">CHIPS</text></g>',
  '<g transform="translate(760 668) rotate(80)"><rect x="-10" y="-40" width="20" height="56" rx="8" fill="#7dd3fc" opacity=".85" stroke="#0284c7" stroke-width="3"/><rect x="-6" y="-50" width="12" height="12" fill="#0284c7"/></g>',
  '<g transform="translate(330 700)"><path d="M-22 0 Q-24 -24 0 -26 Q26 -22 22 2 Q0 14 -22 0 Z" fill="#fff" stroke="#9ca3af" stroke-width="3"/><path d="M-10 -12 L8 -4 M-4 -20 L4 6" stroke="#9ca3af" stroke-width="2"/></g>',
  '<g transform="translate(870 705)"><path d="M-28 0 Q-30 -26 0 -24 Q28 -26 24 2 Q0 12 -28 0 Z" fill="#fde68a" stroke="#ca8a04" stroke-width="3"/></g>',
  '<g transform="translate(640 640) rotate(15)"><path d="M0 0 Q20 -30 40 -10 M0 0 Q-10 -30 -36 -18 M0 0 Q4 -34 4 -42" stroke="#facc15" stroke-width="10" fill="none" stroke-linecap="round"/></g>',
  '<g transform="translate(470 600) rotate(-35)"><rect x="-10" y="-20" width="20" height="40" rx="5" fill="#2563eb"/><rect x="-10" y="-10" width="20" height="8" fill="#93c5fd"/></g>',
  '<g transform="translate(1080 690) rotate(30)"><rect x="-26" y="-10" width="52" height="20" rx="4" fill="#e11d48"/><text x="0" y="6" text-anchor="middle" font-size="12" font-weight="bold" fill="#fff">CANDY</text></g>',
]
b += "".join(litter)
b += '<g fill="#475569"><path d="M600 560 q8 -14 20 0 q-10 6 -20 0z"/><circle cx="622" cy="556" r="5"/><path d="M627 556 l8 2 l-8 2z" fill="#f59e0b"/></g>'
b += '<g transform="translate(250 640)"><path d="M0 0 q10 -20 30 -8" stroke="#94a3b8" stroke-width="3" fill="none"/></g>'
open(OUT + "y1-t2-11.svg", "w").write(svg(b, "A playground with litter on the ground: cans, a crisp packet, a bottle and paper, next to an overflowing bin"))

# 3 — a photo with no caption (an unexplained moment: people stop and look up at something we can't see)
b = '<rect width="1200" height="750" fill="#f1f5f9"/>'
b += '<g transform="translate(600 375) rotate(-2) translate(-560 -340)">'
b += '<rect x="-14" y="-14" width="1148" height="708" fill="#fff" stroke="#e2e8f0" stroke-width="2"/>'
b += '<clipPath id="ph"><rect width="1120" height="680"/></clipPath><g clip-path="url(#ph)">'
b += '<rect width="1120" height="680" fill="#b8c7d9"/><rect width="1120" height="300" fill="#9fb3c8"/>'
b += '<g fill="#cbd5e1" stroke="#94a3b8" stroke-width="2"><rect x="20" y="60" width="260" height="380"/><rect x="300" y="20" width="220" height="420"/><rect x="760" y="80" width="330" height="360"/></g>'
b += "".join(f'<rect x="{40+c*60}" y="{90+r*70}" width="36" height="44" fill="#64748b"/>' for c in range(4) for r in range(4))
b += "".join(f'<rect x="{320+c*52}" y="{50+r*64}" width="32" height="40" fill="#64748b"/>' for c in range(4) for r in range(5))
b += "".join(f'<rect x="{790+c*72}" y="{110+r*70}" width="40" height="44" fill="#64748b"/>' for c in range(4) for r in range(4))
b += '<rect x="560" y="200" width="160" height="240" fill="#a3b1c2"/><rect x="0" y="440" width="1120" height="240" fill="#6b7280"/><rect x="0" y="440" width="1120" height="20" fill="#9ca3af"/>'
b += '<g fill="#4b5563" opacity=".5"><ellipse cx="240" cy="620" rx="90" ry="14"/><ellipse cx="830" cy="640" rx="120" ry="16"/></g>'
crowd = [(150, 600, "#ef4444", "#f2c49b", "stand", False), (240, 610, "#0ea5e9", "#8d5524", "stand", True), (330, 596, "#a855f7", "#e0ac69", "stand", False),
         (520, 616, "#f59e0b", "#c68642", "stand", False), (640, 606, "#22c55e", "#f1c27d", "stand", True), (760, 612, "#14b8a6", "#ffdbac", "stand", False), (900, 600, "#e11d48", "#8d5524", "stand", True)]
for i, (x, y, sh, sk, po, fl) in enumerate(crowd):
    b += kid(x, y, 1.05 - (i % 3) * 0.05, skin=sk, shirt=sh, pants="#1f2937", pose=po, face="o", flip=fl, hairstyle="long" if i % 2 else "short", hair=["#111", "#5b3a1e", "#3b2416", "#7c4a1e"][i % 4])
b += '<g transform="translate(1010 640)"><ellipse cx="0" cy="-30" rx="36" ry="20" fill="#b45309"/><circle cx="34" cy="-52" r="16" fill="#b45309"/><path d="M-22 -14 v20 M18 -14 v20" stroke="#92400e" stroke-width="7"/><path d="M-36 -36 q-16 -14 -6 -26" stroke="#b45309" stroke-width="7" fill="none"/></g>'
b += '<g transform="translate(440 640)"><rect x="-40" y="-60" width="80" height="60" rx="10" fill="#334155"/><circle cx="0" cy="-30" r="18" fill="#94a3b8"/></g>'
b += '<rect width="1120" height="680" fill="#fff7ed" opacity=".08"/></g></g>'
open(OUT + "y5-t2-2.svg", "w").write(svg(b, "A street photo with no caption: a crowd of people has stopped and is staring up at something out of the picture"))
print("ok")
