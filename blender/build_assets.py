# Builds the app's 3D CARTOON assets in Blender and renders them to ../assets/.
#
#   blender -b --python blender/build_assets.py
#
# Style: kawaii clip-top jar - toon shading (flat colour bands + cartoon highlight) with thick
# Freestyle outlines, rendered in EEVEE. Renders (transparent PNG, 2x):
#   assets/jar.png        cream glass jar body + glass lip (behind the stars), 300x424 = the 150x212 CSS .jar box
#   assets/jar-front.png  face + shine stripes that sit in front of the stars, same framing
#   assets/lid.png        white chunky lid, same framing (tinted per group in CSS)
#   assets/lid-clasp.png  metal clip wire, same framing (not tinted, moves with the lid)
#   assets/star-0..5.png  puffy candy stars in 6 colours, 96x96
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

# Jar silhouette (radius, height) from bottom centre up to the lip: wide bottom, rounded shoulder
PROFILE = [(0.0, 0.0), (0.95, 0.0), (1.12, 0.06), (1.19, 0.28), (1.16, 0.95), (1.09, 1.55),
           (0.99, 1.90), (0.87, 2.08), (0.82, 2.16), (0.82, 2.34), (0.86, 2.38)]
FACE_Z = 1.15                                     # height of the eyes

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




def radius_at(z):
    for (r0, z0), (r1, z1) in zip(PROFILE, PROFILE[1:]):
        if z0 <= z <= z1 and z1 > z0:
            return r0 + (r1 - r0) * (z - z0) / (z1 - z0)
    return PROFILE[-1][0]


def on_front(x, z, lift=0.02):
    """Point on the front (-Y) surface of the jar."""
    r = radius_at(z)
    return Vector((x, -math.sqrt(max(r * r - x * x, 0.0)) - lift, z))


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


# Jar body + glass lip ---------------------------------------------------------------
jar = lathe("Jar", PROFILE)
sol = jar.modifiers.new("Thickness", "SOLIDIFY"); sol.thickness = 0.07
smooth(jar); jar.data.materials.append(toon("Glass", GLASS, alpha=GLASS_ALPHA, shine=0.8))
lip_m = toon("Lip", LIP, shine=0.6)
bpy.ops.mesh.primitive_torus_add(major_radius=0.86, minor_radius=0.075, location=(0, 0, 2.30), major_segments=64)
lip = bpy.context.object; lip.name = "Lip"; smooth(lip, 1); lip.data.materials.append(lip_m)

# Shine stripes (front, no outline) ---------------------------------------------------
SHINE_MAT = flat("Shine", (1, 1, 1), alpha=0.85)


def stripe(name, x, z0, z1, width):
    ob_pts = [on_front(x, z, 0.05) for z in (z0, (z0 + z1) / 2, z1)]
    ob = tube(name, ob_pts, width, SHINE_MAT)
    return ob

shine1 = stripe("ShineL", -0.93, 0.35, 1.45, 0.05)
shine2 = stripe("ShineR", 0.95, 0.30, 1.30, 0.045)
shine3 = stripe("ShineDot", 0.92, 1.45, 1.55, 0.045)

# Face (front, outlined) ---------------------------------------------------------------
ink = toon("Ink", INK, shine=0.0)
white = flat("EyeShine", (1, 1, 1))
cheek_m = flat("Cheek", CHEEK, alpha=0.55)
face = []
for side in (-1, 1):
    x = 0.40 * side
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.19, segments=48, ring_count=24, location=on_front(x, FACE_Z, 0.0))
    eye = bpy.context.object; eye.name = f"Eye{side}"; eye.scale = (1, 0.45, 1.08)
    eye.rotation_euler = (0, 0, math.atan2(eye.location.x, -eye.location.y))
    smooth(eye, 0); eye.data.materials.append(ink); face.append(eye)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.055, location=on_front(x - 0.06, FACE_Z + 0.07, 0.11))
    hl = bpy.context.object; hl.name = f"EyeShine{side}"; smooth(hl, 0); hl.data.materials.append(white); face.append(hl)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.022, location=on_front(x + 0.07, FACE_Z - 0.06, 0.11))
    hl2 = bpy.context.object; hl2.name = f"EyeDot{side}"; smooth(hl2, 0); hl2.data.materials.append(white); face.append(hl2)
    brow = tube(f"Brow{side}", [on_front(x - 0.13, FACE_Z + 0.33), on_front(x, FACE_Z + 0.42), on_front(x + 0.13, FACE_Z + 0.33)], 0.028, ink)
    face.append(brow)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.12, location=on_front(0.66 * side, FACE_Z - 0.17, 0.0))
    ch = bpy.context.object; ch.name = f"Cheek{side}"; ch.scale = (1.3, 0.25, 0.75)
    ch.rotation_euler = (0, 0, math.atan2(ch.location.x, -ch.location.y))
    smooth(ch, 0); ch.data.materials.append(cheek_m); face.append(ch)

# open smile: half disc + teeth strip
bm = bmesh.new()
pts = [bm.verts.new((0.13 * math.cos(a), 0, -0.13 * math.sin(a) * 0.9)) for a in [i * math.pi / 16 for i in range(17)]]
bm.faces.new(pts)
me = bpy.data.meshes.new("Mouth"); bm.to_mesh(me); bm.free()
mouth = bpy.data.objects.new("Mouth", me); scene.collection.objects.link(mouth)
mouth.location = on_front(0, FACE_Z - 0.12, 0.03)
sm = mouth.modifiers.new("Depth", "SOLIDIFY"); sm.thickness = 0.03
mouth.data.materials.append(ink); face.append(mouth)
bpy.ops.mesh.primitive_cube_add(size=1, location=on_front(0, FACE_Z - 0.135, 0.05))
teeth = bpy.context.object; teeth.name = "Teeth"; teeth.scale = (0.16, 0.01, 0.035)
teeth.data.materials.append(white); face.append(teeth)
face_coll = collect("Face", *face)

# Lid: chunky rounded cap ------------------------------------------------------------
lid_mat = toon("Lid", LID, shine=0.5)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=1.0, depth=0.42, location=(0, 0, 2.58))
lid = bpy.context.object; lid.name = "Lid"
lb = lid.modifiers.new("Round", "BEVEL"); lb.width = 0.16; lb.segments = 8
smooth(lid, 1); lid.data.materials.append(lid_mat)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.78, depth=0.08, location=(0, 0, 2.80))
cap = bpy.context.object; cap.name = "LidTop"
cb = cap.modifiers.new("Round", "BEVEL"); cb.width = 0.035; cb.segments = 4
smooth(cap, 1); cap.data.materials.append(lid_mat)

# Clip wire: hooks under the glass lip on the front-left and runs up over the lid edge
metal = toon("Metal", METAL, shine=0.8)
clasp = tube("Clasp", [(-0.62, -0.62, 2.22), (-0.80, -0.70, 2.45), (-0.70, -0.80, 2.74),
                       (-0.30, -0.95, 2.82), (0.35, -0.92, 2.80), (0.62, -0.72, 2.72)], 0.045, metal)
bpy.ops.mesh.primitive_cylinder_add(radius=0.07, depth=0.16, location=(-0.70, -0.79, 2.74))
knuckle = bpy.context.object; knuckle.name = "ClaspKnuckle"; knuckle.rotation_euler = (0, math.radians(90), math.radians(-30))
smooth(knuckle, 0); knuckle.data.materials.append(metal)

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


W, Hpx = BOX_W * SCALE, BOX_H * SCALE
only(jar, lip)
render(os.path.join(ASSETS, "jar.png"), W, Hpx)
only(shine1, shine2, shine3, *face)
render(os.path.join(ASSETS, "jar-front.png"), W, Hpx, line_coll=face_coll)
only(lid, cap)
render(os.path.join(ASSETS, "lid.png"), W, Hpx)
only(clasp, knuckle)
render(os.path.join(ASSETS, "lid-clasp.png"), W, Hpx)

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
star.location = (0, 0, 0.6)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "assets.blend"))
