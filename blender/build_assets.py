# Builds the app's 3D CARTOON assets in Blender and renders them to ../assets/.
#
#   blender -b --python blender/build_assets.py
#
# Style: kawaii jars - toon shading (flat colour bands + cartoon highlight) with thick Freestyle
# outlines, rendered in EEVEE. For every shape in SHAPES it renders (transparent PNG, 2x, 300x424 =
# the 150x212 CSS .jar box) into assets/jars/<shape>/:
#   jar.png        cream glass body + glass lip (behind the stars)
#   front.png      brows, mouth, cheeks + shine stripes (in front of the stars)
#   eyes-open|closed|happy.png  eye states the app swaps between to blink / smile
#   lid.png        white lid (tinted per group in CSS)       extra.png  untinted lid hardware (clip wire)
# plus assets/jars/shapes.js - the measured star area + lid hinge for each shape, used by app.js,
# and assets/star-0..5.png - puffy candy stars in 6 colours, 96x96.
# Also saves blender/assets.blend for hand tweaking.
# The photoreal look lives in build_assets_realistic.py.
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))
os.makedirs(ASSETS, exist_ok=True)

# Design knobs ------------------------------------------------------------------
OUTLINE = (0.15, 0.09, 0.14)                      # ink colour for outlines
OUTLINE_PX = 5.0                                  # outline thickness (render px, 2x)
GLASS = (1.0, 0.95, 0.86)                         # creamy cartoon glass
GLASS_ALPHA = 0.88
LIP = (0.55, 0.66, 0.74)                          # grey-blue glass lip
METAL = (0.55, 0.66, 0.74)                        # clip wire
LID = (1.0, 1.0, 1.0)                             # white: CSS tints it per group
INK = (0.13, 0.07, 0.15)                          # eyes / mouth
CHEEK = (1.0, 0.55, 0.6)
STAR_COLORS = [(1.0, 0.80, 0.05), (1.0, 0.35, 0.65), (0.25, 0.70, 1.0),
               (0.45, 0.88, 0.20), (1.0, 0.52, 0.10), (0.68, 0.40, 1.0)]
BOX_W, BOX_H, SCALE = 150, 212, 2


# Jar shapes: silhouette = (radius, height) from bottom centre up to the lip -----------
SHAPES = {
    "clip": dict(label="Clip jar", icon="🫙",
                 profile=[(0.0, 0.0), (0.95, 0.0), (1.12, 0.06), (1.19, 0.28), (1.16, 0.95), (1.09, 1.55),
                          (0.99, 1.90), (0.87, 2.08), (0.82, 2.16), (0.82, 2.34), (0.86, 2.38)],
                 face_z=1.15, lid=dict(r=1.0, depth=0.42, z=2.58, style="clip")),
    "round": dict(label="Cookie jar", icon="🍪",
                  profile=[(0.0, 0.0), (0.72, 0.0), (0.98, 0.08), (1.17, 0.40), (1.22, 0.95), (1.16, 1.50),
                           (0.98, 1.88), (0.80, 2.06), (0.75, 2.14), (0.75, 2.26), (0.79, 2.30)],
                  face_z=1.05, lid=dict(r=0.92, depth=0.32, z=2.44, style="knob")),
    "tall": dict(label="Tall jar", icon="🧪",
                 profile=[(0.0, 0.0), (0.80, 0.0), (0.93, 0.06), (0.98, 0.25), (0.98, 2.15), (0.90, 2.42),
                          (0.74, 2.58), (0.71, 2.64), (0.71, 2.74), (0.75, 2.78)],
                 face_z=1.55, lid=dict(r=0.84, depth=0.36, z=2.95, style="screw")),
    "mason": dict(label="Mason jar", icon="🥫",
                  profile=[(0.0, 0.0), (1.02, 0.0), (1.14, 0.08), (1.18, 0.30), (1.18, 1.55), (1.11, 1.86),
                           (0.96, 2.02), (0.93, 2.08), (0.93, 2.20), (0.97, 2.24)],
                  face_z=1.0, lid=dict(r=1.03, depth=0.36, z=2.40, style="screw")),
}
STAR_PX, ROW_PX, CAP = 26, 13, 50   # must match app.js

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


# Toon material: diffuse -> 3 flat bands * colour, plus a hard cartoon highlight -----
def toon(name, color, alpha=1.0, shine=0.55):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree; N = nt.nodes; L = nt.links
    N.clear()
    out = N.new("ShaderNodeOutputMaterial")

    dif = N.new("ShaderNodeBsdfDiffuse")
    s2r = N.new("ShaderNodeShaderToRGB"); L.new(dif.outputs[0], s2r.inputs[0])
    ramp = N.new("ShaderNodeValToRGB"); ramp.color_ramp.interpolation = "CONSTANT"
    e = ramp.color_ramp.elements
    e[0].position, e[0].color = 0.0, (0.62, 0.58, 0.78, 1)     # shadow band (cool)
    e[1].position, e[1].color = 0.12, (0.86, 0.85, 0.92, 1)    # mid band
    e.new(0.45).color = (1, 1, 1, 1)                            # lit band
    L.new(s2r.outputs[0], ramp.inputs[0])

    base = N.new("ShaderNodeMix"); base.data_type = "RGBA"; base.blend_type = "MULTIPLY"
    base.inputs["Factor"].default_value = 1.0
    base.inputs[7].default_value = (*color, 1)
    L.new(ramp.outputs[0], base.inputs[6])

    gl = N.new("ShaderNodeBsdfGlossy"); gl.inputs["Roughness"].default_value = 0.25
    s2r2 = N.new("ShaderNodeShaderToRGB"); L.new(gl.outputs[0], s2r2.inputs[0])
    hr = N.new("ShaderNodeValToRGB"); hr.color_ramp.interpolation = "CONSTANT"
    hr.color_ramp.elements[0].color = (0, 0, 0, 1)
    hr.color_ramp.elements[1].position = 0.55
    L.new(s2r2.outputs[0], hr.inputs[0])

    add = N.new("ShaderNodeMix"); add.data_type = "RGBA"; add.blend_type = "ADD"
    add.inputs["Factor"].default_value = shine
    L.new(base.outputs[2], add.inputs[6]); L.new(hr.outputs[0], add.inputs[7])

    em = N.new("ShaderNodeEmission"); L.new(add.outputs[2], em.inputs[0])
    if alpha < 1:
        tr = N.new("ShaderNodeBsdfTransparent")
        mix = N.new("ShaderNodeMixShader"); mix.inputs[0].default_value = alpha
        L.new(tr.outputs[0], mix.inputs[1]); L.new(em.outputs[0], mix.inputs[2])
        L.new(mix.outputs[0], out.inputs[0])
        for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND"), ("use_backface_culling", False)):
            try: setattr(m, attr, val)
            except Exception: pass
    else:
        L.new(em.outputs[0], out.inputs[0])
    return m


def flat(name, color, alpha=1.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    N = m.node_tree.nodes; L = m.node_tree.links; N.clear()
    out = N.new("ShaderNodeOutputMaterial"); em = N.new("ShaderNodeEmission")
    em.inputs[0].default_value = (*color, 1)
    if alpha < 1:
        tr = N.new("ShaderNodeBsdfTransparent"); mix = N.new("ShaderNodeMixShader")
        mix.inputs[0].default_value = alpha
        L.new(tr.outputs[0], mix.inputs[1]); L.new(em.outputs[0], mix.inputs[2]); L.new(mix.outputs[0], out.inputs[0])
        try: m.surface_render_method = "BLENDED"
        except Exception: pass
    else:
        L.new(em.outputs[0], out.inputs[0])
    return m


def smooth(ob, subsurf=2):
    for p in ob.data.polygons:
        p.use_smooth = True
    if subsurf:
        s = ob.modifiers.new("Subsurf", "SUBSURF"); s.levels = s.render_levels = subsurf


# Jar: spin the profile into a lathe mesh ---------------------------------------------
def lathe(name, profile, segments=64):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    verts = [bm.verts.new((r, 0, z)) for r, z in profile]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=math.tau, steps=segments, use_duplicate=False)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    return ob



def radius_at(profile, z):
    for (r0, z0), (r1, z1) in zip(profile, profile[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return profile[-1][0]


def collect(name, *obs):
    c = bpy.data.collections.new(name); scene.collection.children.link(c)
    for ob in obs:
        for uc in ob.users_collection:
            uc.objects.unlink(ob)
        c.objects.link(ob)
    return c


def tube(name, pts, radius, material):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"
    cu.bevel_depth = radius; cu.bevel_resolution = 6; cu.use_fill_caps = True
    sp = cu.splines.new("NURBS"); sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (*co, 1)
    sp.use_endpoint_u = True; sp.order_u = 3
    ob = bpy.data.objects.new(name, cu); scene.collection.objects.link(ob)
    cu.materials.append(material)
    return ob


def sphere(name, radius, loc, mat, scale=(1, 1, 1), face_out=False, segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=segments, ring_count=segments // 2)
    ob = bpy.context.object; ob.name = name; ob.scale = scale
    if face_out:
        ob.rotation_euler = (0, 0, math.atan2(ob.location.x, -ob.location.y))
    smooth(ob, 0); ob.data.materials.append(mat)
    return ob


# Shared materials ---------------------------------------------------------------------
glass_m = toon("Glass", GLASS, alpha=GLASS_ALPHA, shine=0.8)
lip_m = toon("Lip", LIP, shine=0.6)
SHINE_MAT = flat("Shine", (1, 1, 1), alpha=0.85)
ink = toon("Ink", INK, shine=0.0)
white = flat("EyeShine", (1, 1, 1))
cheek_m = flat("Cheek", CHEEK, alpha=0.55)
lid_mat = toon("Lid", LID, shine=0.5)
metal = toon("Metal", METAL, shine=0.8)


def build_shape(key, spec):
    """Create every object for one jar shape. Returns dict of render layers."""
    prof, fz, ld = spec["profile"], spec["face_z"], spec["lid"]
    top_z = prof[-1][1]
    rmax = max(r for r, _ in prof)

    def on_front(x, z, lift=0.02):
        r = radius_at(prof, z)
        return Vector((x, -math.sqrt(max(r * r - x * x, 0.0)) - lift, z))

    jar = lathe(f"{key}.Jar", prof)
    jar.modifiers.new("Thickness", "SOLIDIFY").thickness = 0.07
    smooth(jar); jar.data.materials.append(glass_m)
    lip_r = prof[-2][0] + 0.04
    bpy.ops.mesh.primitive_torus_add(major_radius=lip_r, minor_radius=0.075, location=(0, 0, top_z - 0.08), major_segments=64)
    lip = bpy.context.object; lip.name = f"{key}.Lip"; smooth(lip, 1); lip.data.materials.append(lip_m)

    # shine stripes follow the body, left and right
    body_z0, body_z1 = 0.32, fz + 0.35
    sx = rmax * 0.80
    shines = [tube(f"{key}.ShineL", [on_front(-sx, z, 0.05) for z in (body_z0, (body_z0 + body_z1) / 2, body_z1)], 0.05, SHINE_MAT),
              tube(f"{key}.ShineR", [on_front(sx, z, 0.05) for z in (body_z0, (body_z0 + body_z1) / 2 - 0.1, body_z1 - 0.2)], 0.045, SHINE_MAT),
              tube(f"{key}.ShineDot", [on_front(sx, z, 0.05) for z in (body_z1 - 0.05, body_z1, body_z1 + 0.05)], 0.045, SHINE_MAT)]

    face, eo, ec, eh = [], [], [], []
    for side in (-1, 1):
        x = 0.40 * side
        eo.append(sphere(f"{key}.Eye{side}", 0.19, on_front(x, fz, 0.0), ink, (1, 0.45, 1.08), True, 48))
        eo.append(sphere(f"{key}.EyeShine{side}", 0.055, on_front(x - 0.06, fz + 0.07, 0.11), white))
        eo.append(sphere(f"{key}.EyeDot{side}", 0.022, on_front(x + 0.07, fz - 0.06, 0.11), white))
        face.append(tube(f"{key}.Brow{side}", [on_front(x - 0.13, fz + 0.33), on_front(x, fz + 0.42), on_front(x + 0.13, fz + 0.33)], 0.028, ink))
        ec.append(tube(f"{key}.Closed{side}", [on_front(x - 0.16, fz + 0.02, 0.04), on_front(x, fz - 0.08, 0.04), on_front(x + 0.16, fz + 0.02, 0.04)], 0.035, ink))
        eh.append(tube(f"{key}.Happy{side}", [on_front(x - 0.16, fz - 0.06, 0.04), on_front(x, fz + 0.10, 0.04), on_front(x + 0.16, fz - 0.06, 0.04)], 0.035, ink))
        face.append(sphere(f"{key}.Cheek{side}", 0.12, on_front(0.66 * side, fz - 0.17, 0.0), cheek_m, (1.3, 0.25, 0.75), True))
    bm = bmesh.new()
    pts = [bm.verts.new((0.13 * math.cos(a), 0, -0.13 * math.sin(a) * 0.9)) for a in [i * math.pi / 16 for i in range(17)]]
    bm.faces.new(pts)
    me = bpy.data.meshes.new(f"{key}.Mouth"); bm.to_mesh(me); bm.free()
    mouth = bpy.data.objects.new(f"{key}.Mouth", me); scene.collection.objects.link(mouth)
    mouth.location = on_front(0, fz - 0.12, 0.03)
    mouth.modifiers.new("Depth", "SOLIDIFY").thickness = 0.03
    mouth.data.materials.append(ink); face.append(mouth)
    bpy.ops.mesh.primitive_cube_add(size=1, location=on_front(0, fz - 0.135, 0.05))
    teeth = bpy.context.object; teeth.name = f"{key}.Teeth"; teeth.scale = (0.16, 0.01, 0.035)
    teeth.data.materials.append(white); face.append(teeth)

    # lid
    lr, ldep, lz = ld["r"], ld["depth"], ld["z"]
    bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=lr, depth=ldep, location=(0, 0, lz))
    lid = bpy.context.object; lid.name = f"{key}.Lid"
    b = lid.modifiers.new("Round", "BEVEL"); b.width = min(0.16, ldep * 0.38); b.segments = 8
    smooth(lid, 1); lid.data.materials.append(lid_mat)
    lid_parts, extra = [lid], []
    if ld["style"] in ("clip", "knob"):
        bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=lr * 0.78, depth=0.08, location=(0, 0, lz + ldep / 2))
        cap = bpy.context.object; cap.name = f"{key}.LidTop"
        cb = cap.modifiers.new("Round", "BEVEL"); cb.width = 0.035; cb.segments = 4
        smooth(cap, 1); cap.data.materials.append(lid_mat); lid_parts.append(cap)
    if ld["style"] == "knob":
        lid_parts.append(sphere(f"{key}.Knob", 0.24, (0, 0, lz + ldep / 2 + 0.16), lid_mat, (1, 1, 0.8), segments=48))
    if ld["style"] == "screw":   # ridged band like a screw-top lid
        for k in range(3):
            zz = lz - ldep / 2 + ldep * (0.25 + 0.25 * k)
            bpy.ops.mesh.primitive_torus_add(major_radius=lr + 0.005, minor_radius=0.03, location=(0, 0, zz), major_segments=64)
            rg = bpy.context.object; rg.name = f"{key}.Ridge{k}"; smooth(rg, 1); rg.data.materials.append(lid_mat)
            lid_parts.append(rg)
    if ld["style"] == "clip":
        lip_z = top_z - 0.16
        extra.append(tube(f"{key}.Clasp", [(-0.62, -0.62, lip_z), (-0.80, -0.70, lz - 0.13), (-0.70, -0.80, lz + 0.16),
                                           (-0.30, -0.95, lz + 0.24), (0.35, -0.92, lz + 0.22), (0.62, -0.72, lz + 0.14)], 0.045, metal))
        bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.16, location=(-0.70, -0.79, lz + 0.16))
        kn = bpy.context.object; kn.name = f"{key}.Knuckle"; kn.rotation_euler = (0, math.radians(90), math.radians(-30))
        smooth(kn, 0); kn.data.materials.append(metal); extra.append(kn)

    return dict(jar=[jar, lip], front=shines + face, face=face, eyes_open=eo, eyes_closed=ec, eyes_happy=eh,
                lid=lid_parts, extra=extra)

# Puffy star ---------------------------------------------------------------------------
def star_mesh(r_out=0.5, r_in=0.25, depth=0.24):
    bm = bmesh.new(); pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = r_out if i % 2 == 0 else r_in
        pts.append(bm.verts.new((r * math.cos(a), r * math.sin(a), -depth / 2)))
    face = bm.faces.new(pts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, 0, depth), verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Star"); bm.to_mesh(me); bm.free()
    return me

star = bpy.data.objects.new("Star", star_mesh()); scene.collection.objects.link(star)
sb = star.modifiers.new("Puff", "BEVEL"); sb.width = 0.09; sb.segments = 4
smooth(star, 2)
star_mats = [toon(f"Star{i}", c, shine=0.6) for i, c in enumerate(STAR_COLORS)]
star.data.materials.append(star_mats[0])
star.location = (40, 0, 0)

# Light + world ------------------------------------------------------------------------
sun_d = bpy.data.lights.new("Sun", "SUN"); sun_d.energy = 3.0; sun_d.angle = math.radians(10)
sun = bpy.data.objects.new("Sun", sun_d); scene.collection.objects.link(sun)
sun.rotation_euler = (math.radians(50), math.radians(-20), math.radians(-35))
world = bpy.data.worlds.new("World"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.4

# Render settings: EEVEE (needed for Shader-to-RGB) + Freestyle outlines ----------------
scene.render.engine = "BLENDER_EEVEE"
scene.eevee.taa_render_samples = 64
scene.render.film_transparent = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "Standard"   # keep cartoon colours punchy
scene.render.line_thickness_mode = "ABSOLUTE"
fs = bpy.context.view_layer.freestyle_settings
fs.crease_angle = math.radians(120)
ls = fs.linesets[0] if len(fs.linesets) else fs.linesets.new("Ink")
if ls.linestyle is None:
    ls.linestyle = bpy.data.linestyles.new("Ink")
ls.select_silhouette = ls.select_border = True
ls.select_crease = False
ls.linestyle.color = OUTLINE
ls.linestyle.thickness = OUTLINE_PX
ls.linestyle.thickness_position = "CENTER"
ls.linestyle.caps = "ROUND"

cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"; cam_d.sensor_fit = "HORIZONTAL"
UNITS_W = 2.65
cam_d.ortho_scale = UNITS_W
cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
TILT = math.radians(8)
center_z = -0.25 + (UNITS_W * BOX_H / BOX_W) / 2
cam.rotation_euler = (math.pi / 2 - TILT, 0, 0)
cam.location = Vector((0, -10 * math.cos(TILT), center_z + 10 * math.sin(TILT)))


def render(path, w, h, outlines=True, line_coll=None):
    scene.render.use_freestyle = outlines
    ls.select_by_collection = line_coll is not None
    if line_coll is not None:
        ls.collection = line_coll
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path)


def only(*obs):
    for ob in scene.objects:
        if ob.type in ("MESH", "CURVE"):
            ob.hide_render = ob not in obs


from bpy_extras.object_utils import world_to_camera_view


def to_css(co):
    v = world_to_camera_view(scene, cam, Vector(co))
    return v.x * BOX_W, (1 - v.y) * BOX_H


def measure(spec):
    """Star area (CSS px inside the .jar box) + lid hinge point for one shape."""
    prof, ld = spec["profile"], spec["lid"]
    rmax = max(r for r, _ in prof)
    floor_z = 0.12
    top_z = max(z for r, z in prof if r >= rmax * 0.86)          # where the shoulder starts
    zs = [floor_z + (top_z - floor_z) * t / 20 for t in range(21)]
    rmin = min(radius_at(prof, z) for z in zs[3:])                # narrowest part of the body (ignore the rounded foot)
    ppu = BOX_W / UNITS_W
    w = 2 * (rmin - 0.10) * ppu
    _, y_floor = to_css((0, 0, floor_z)); _, y_top = to_css((0, 0, top_z))
    h = y_floor - y_top
    half = w / 2
    m0 = max(0.0, half - (radius_at(prof, floor_z + 0.05) - 0.12) * ppu)
    m1 = max(0.0, half - (radius_at(prof, floor_z + 0.05 + ROW_PX / ppu) - 0.10) * ppu)
    cols = max(5, int((w - STAR_PX) // 14) + 1)
    rows = max(-(-CAP // cols), int((h - STAR_PX) // ROW_PX) + 1)
    hx, hy = to_css((-ld["r"], 0, ld["z"] - ld["depth"] / 2))
    return dict(left=round(BOX_W / 2 - half, 1), bottom=round(BOX_H - y_floor, 1), w=round(w, 1), h=round(h, 1),
                cols=cols, rows=rows, m0=round(m0, 1), m1=round(m1, 1), lidX=round(hx, 1), lidY=round(hy, 1))


W, Hpx = BOX_W * SCALE, BOX_H * SCALE
manifest = {}
for key, spec in SHAPES.items():
    layers = build_shape(key, spec)
    face_coll = collect(f"{key}.Face", *layers["face"])
    eyes_coll = collect(f"{key}.EyesOpen", *layers["eyes_open"])
    out = os.path.join(ASSETS, "jars", key); os.makedirs(out, exist_ok=True)
    only(*layers["jar"]); render(os.path.join(out, "jar.png"), W, Hpx)
    only(*layers["front"]); render(os.path.join(out, "front.png"), W, Hpx, line_coll=face_coll)
    only(*layers["eyes_open"]); render(os.path.join(out, "eyes-open.png"), W, Hpx, line_coll=eyes_coll)
    only(*layers["eyes_closed"]); render(os.path.join(out, "eyes-closed.png"), W, Hpx, outlines=False)
    only(*layers["eyes_happy"]); render(os.path.join(out, "eyes-happy.png"), W, Hpx, outlines=False)
    only(*layers["lid"]); render(os.path.join(out, "lid.png"), W, Hpx)
    if layers["extra"]:
        only(*layers["extra"]); render(os.path.join(out, "extra.png"), W, Hpx)
    manifest[key] = dict(label=spec["label"], icon=spec["icon"], extra=bool(layers["extra"]), stars=measure(spec))
    # keep only the first shape in the saved .blend; hide the rest away
    if key != next(iter(SHAPES)):
        for ob in [o for o in scene.objects if o.name.startswith(key + ".")]:
            bpy.data.objects.remove(ob, do_unlink=True)

import json
with open(os.path.join(ASSETS, "jars", "shapes.js"), "w") as f:
    f.write("// Generated by blender/build_assets.py - star area + lid hinge per jar shape (CSS px in the 150x212 jar box)\n")
    f.write("window.JAR_SHAPES = " + json.dumps(manifest, indent=2, ensure_ascii=False) + ";\n")
print("wrote shapes.js", json.dumps(manifest))

# Stars: one colour each, tilted differently
only(star)
cam.location = star.location + Vector((0, -10, 0)); cam.rotation_euler = (math.pi / 2, 0, 0)
cam_d.ortho_scale = 1.3
ls.linestyle.thickness = 3.0
tilts = [(90, 0, 0), (72, 18, 10), (104, -22, -14), (82, 30, 24), (96, -12, 30), (78, -26, -8)]
for i, (rx, ry, rz) in enumerate(tilts):
    star.data.materials[0] = star_mats[i]
    star.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    render(os.path.join(ASSETS, f"star-{i}.png"), 96, 96)

for ob in scene.objects:
    ob.hide_render = False
star.location = (2.5, 0, 0.6)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "assets.blend"))
