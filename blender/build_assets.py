# Builds the app's 3D CARTOON assets in Blender and renders them to ../assets/.
#
#   blender -b --python blender/build_assets.py
#
# Style: toon shading (flat colour bands + a cartoon highlight) with Freestyle outlines, rendered in EEVEE.
# Renders (transparent PNG, 2x):
#   assets/jar.png        chubby cartoon glass jar body (behind the stars), 300x424 = the 150x212 CSS .jar box
#   assets/jar-front.png  shine stripes that sit in front of the stars, same framing
#   assets/lid.png        white chunky lid with knob, same framing (tinted per group in CSS)
#   assets/star-0..5.png  puffy candy stars in 6 colours, 96x96
# Also saves blender/assets.blend for hand tweaking.
# The previous photoreal look lives in build_assets_realistic.py.
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))
os.makedirs(ASSETS, exist_ok=True)

# Design knobs ------------------------------------------------------------------
OUTLINE = (0.16, 0.10, 0.30)                      # ink colour for outlines
OUTLINE_PX = 3.2                                  # outline thickness (render px, 2x)
GLASS = (0.80, 0.95, 1.0)                         # cartoon glass tint
GLASS_ALPHA = 0.30
LID = (1.0, 1.0, 1.0)                             # white: CSS tints it per group
STAR_COLORS = [(1.0, 0.80, 0.05), (1.0, 0.35, 0.65), (0.25, 0.70, 1.0),
               (0.45, 0.88, 0.20), (1.0, 0.52, 0.10), (0.68, 0.40, 1.0)]
BOX_W, BOX_H, SCALE = 150, 212, 2

# Jar silhouette (radius, height) from bottom centre up to the lip - a chubby cookie jar
PROFILE = [(0.0, 0.0), (0.70, 0.0), (0.92, 0.06), (1.04, 0.28), (1.10, 0.75), (1.10, 1.45),
           (1.04, 1.95), (0.90, 2.22), (0.80, 2.34), (0.80, 2.44), (0.86, 2.50)]

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


jar = lathe("Jar", PROFILE)
sol = jar.modifiers.new("Thickness", "SOLIDIFY"); sol.thickness = 0.06
smooth(jar); jar.data.materials.append(toon("Glass", GLASS, alpha=GLASS_ALPHA, shine=0.9))

# cartoon shine stripes on the front-left of the glass
SHINE_MAT = flat("Shine", (1, 1, 1), alpha=0.6)


def stripe(name, angle_deg, z0, z1, width):
    a = math.radians(angle_deg)
    bpy.ops.mesh.primitive_cube_add(size=1)
    ob = bpy.context.object; ob.name = name
    ob.scale = (width, 0.02, (z1 - z0))
    ob.location = (1.13 * math.sin(a), -1.13 * math.cos(a), (z0 + z1) / 2)
    ob.rotation_euler = (0, 0, a)
    bv = ob.modifiers.new("Round", "BEVEL"); bv.width = width * 0.49; bv.segments = 6; bv.affect = "EDGES"
    ob.data.materials.append(SHINE_MAT)
    return ob

shine1 = stripe("Shine1", -40, 0.75, 1.55, 0.11)
shine2 = stripe("Shine2", -28, 1.25, 1.45, 0.06)

# Lid: chunky disc + rim + knob ---------------------------------------------------------
lid_mat = toon("Lid", LID, shine=0.5)
bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=0.98, depth=0.30, location=(0, 0, 2.62))
lid = bpy.context.object; lid.name = "Lid"
lb = lid.modifiers.new("Round", "BEVEL"); lb.width = 0.12; lb.segments = 6
smooth(lid, 1); lid.data.materials.append(lid_mat)
bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(0, 0, 2.86), segments=48, ring_count=24)
knob = bpy.context.object; knob.name = "Knob"; knob.scale = (1, 1, 0.8)
smooth(knob, 1); knob.data.materials.append(lid_mat)

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
scene.render.use_freestyle = True
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

cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"; cam_d.sensor_fit = "HORIZONTAL"
UNITS_W = 2.7
cam_d.ortho_scale = UNITS_W
cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam); scene.camera = cam
TILT = math.radians(10)
center_z = -0.42 + (UNITS_W * BOX_H / BOX_W) / 2
cam.rotation_euler = (math.pi / 2 - TILT, 0, 0)
cam.location = Vector((0, -10 * math.cos(TILT), center_z + 10 * math.sin(TILT)))


def render(path, w, h, outlines=True):
    scene.render.use_freestyle = outlines
    scene.render.resolution_x, scene.render.resolution_y = w, h
    scene.render.resolution_percentage = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    print("wrote", path)


def only(*obs):
    for ob in scene.objects:
        if ob.type == "MESH":
            ob.hide_render = ob not in obs


W, Hpx = BOX_W * SCALE, BOX_H * SCALE
only(jar)
render(os.path.join(ASSETS, "jar.png"), W, Hpx)
only(shine1, shine2)
render(os.path.join(ASSETS, "jar-front.png"), W, Hpx, outlines=False)
only(lid, knob)
render(os.path.join(ASSETS, "lid.png"), W, Hpx)

# Stars: one colour each, tilted differently
only(star)
cam.location = star.location + Vector((0, -10, 0)); cam.rotation_euler = (math.pi / 2, 0, 0)
cam_d.ortho_scale = 1.3
ls.linestyle.thickness = 2.4
tilts = [(90, 0, 0), (72, 18, 10), (104, -22, -14), (82, 30, 24), (96, -12, 30), (78, -26, -8)]
for i, (rx, ry, rz) in enumerate(tilts):
    star.data.materials[0] = star_mats[i]
    star.rotation_euler = (math.radians(rx), math.radians(ry), math.radians(rz))
    render(os.path.join(ASSETS, f"star-{i}.png"), 96, 96)

only(jar, shine1, shine2, lid, knob, star)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "assets.blend"))
