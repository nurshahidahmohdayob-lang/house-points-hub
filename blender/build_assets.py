# Builds the app's 3D assets in Blender and renders them to ../assets/.
#
#   blender -b --python blender/build_assets.py
#
# Renders (transparent PNG, 2x for sharp screens):
#   assets/jar.png     glass jar body, 300x424, framed to match the .jar box (150x212 CSS px)
#   assets/lid.png     white lid in the same framing (tinted per group in CSS)
#   assets/star-0..3.png  gold star from 4 angles, 96x96
# Also saves blender/assets.blend so the scene can be opened and tweaked by hand.
import bpy, bmesh, math, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.normpath(os.path.join(HERE, "..", "assets"))
os.makedirs(ASSETS, exist_ok=True)

# Design knobs -------------------------------------------------------------
H, R = 2.4, 1.0            # jar height / radius (Blender units)
GLASS_IOR = 1.2
LID_COLOR = (0.92, 0.92, 0.92)
STAR_COLOR = (1.0, 0.6, 0.04)
BOX_W, BOX_H = 150, 212     # CSS size of the .jar box
SCALE = 2                   # render at 2x

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene


def mat(name, color, metallic=0.0, rough=0.4, transmission=0.0, ior=1.45):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["IOR"].default_value = ior
    b.inputs["Transmission Weight"].default_value = transmission
    return m


def smooth(ob):
    for p in ob.data.polygons:
        p.use_smooth = True


glass = mat("Glass", (0.97, 0.99, 1.0), rough=0.02, transmission=1.0, ior=GLASS_IOR)
gold = mat("Gold", STAR_COLOR, metallic=0.85, rough=0.3)
lid_m = mat("Lid", LID_COLOR, rough=0.3)

# Jar ----------------------------------------------------------------------
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=R, depth=H, location=(0, 0, H / 2))
jar = bpy.context.object; jar.name = "Jar"
bm = bmesh.new(); bm.from_mesh(jar.data)
bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z > 0.9], context="FACES")
bm.to_mesh(jar.data); bm.free()
bev = jar.modifiers.new("Bevel", "BEVEL"); bev.width = 0.35; bev.segments = 10; bev.limit_method = "ANGLE"
sol = jar.modifiers.new("Solidify", "SOLIDIFY"); sol.thickness = 0.05
jar.modifiers.new("WN", "WEIGHTED_NORMAL")
smooth(jar); jar.data.materials.append(glass)

bpy.ops.mesh.primitive_torus_add(major_radius=R - 0.02, minor_radius=0.06, location=(0, 0, H), major_segments=96)
rim = bpy.context.object; rim.name = "Rim"; smooth(rim); rim.data.materials.append(glass)

bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=R + 0.07, depth=0.3, location=(0, 0, H + 0.17))
lid = bpy.context.object; lid.name = "Lid"
lb = lid.modifiers.new("Bevel", "BEVEL"); lb.width = 0.07; lb.segments = 5
smooth(lid); lid.data.materials.append(lid_m)


# Star ---------------------------------------------------------------------
def star_mesh(r_out=0.5, r_in=0.21, depth=0.17):
    bm = bmesh.new()
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        r = r_out if i % 2 == 0 else r_in
        pts.append(bm.verts.new((r * math.cos(a), r * math.sin(a), -depth / 2)))
    face = bm.faces.new(pts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, 0, depth), verts=[v for v in ext["geom"] if isinstance(v, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("Star"); bm.to_mesh(me); bm.free()
    me.materials.append(gold)
    return me

star = bpy.data.objects.new("Star", star_mesh())
scene.collection.objects.link(star)
sb = star.modifiers.new("Bevel", "BEVEL"); sb.width = 0.04; sb.segments = 3
star.location = (40, 0, 0)  # parked away from the jar

# Lights + world -------------------------------------------------------------
def area(name, loc, energy, size, target):
    ld = bpy.data.lights.new(name, "AREA"); ld.energy = energy; ld.size = size
    ob = bpy.data.objects.new(name, ld); scene.collection.objects.link(ob); ob.location = loc
    c = ob.constraints.new("TRACK_TO"); c.target = target; c.track_axis = "TRACK_NEGATIVE_Z"; c.up_axis = "UP_Y"
    return ob

bpy.ops.object.empty_add(location=(0, 0, 1.3)); jar_aim = bpy.context.object
key = area("Key", (3.5, -4, 5), 900, 4, jar_aim)
rimL = area("Rim", (-4, 3, 4), 700, 3, jar_aim)
fill = area("Fill", (-4, -3.5, 1.5), 250, 4, jar_aim)

world = bpy.data.worlds.new("World"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (1.0, 0.95, 0.85, 1)
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.5

# Render settings -------------------------------------------------------------
scene.render.engine = "CYCLES"
try:
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices: d.use = True
    scene.cycles.device = "GPU"
except Exception as e:
    print("GPU setup skipped:", e)
scene.cycles.samples = 128
scene.cycles.use_denoising = True
scene.cycles.transmission_bounces = scene.cycles.transparent_max_bounces = scene.cycles.max_bounces = 12
scene.render.film_transparent = True
scene.cycles.film_transparent_glass = True
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGBA"
scene.view_settings.view_transform = "AgX"
try: scene.view_settings.look = "AgX - Punchy"
except Exception: pass

# Orthographic camera matching the CSS box: width = BOX_W px
cam_d = bpy.data.cameras.new("Cam"); cam_d.type = "ORTHO"; cam_d.sensor_fit = "HORIZONTAL"
UNITS_W = 2.6                         # Blender units across the box width
cam_d.ortho_scale = UNITS_W
cam = bpy.data.objects.new("Cam", cam_d); scene.collection.objects.link(cam)
scene.camera = cam
TILT = math.radians(9)                # look slightly down so the jar opening shows
box_h_units = UNITS_W * BOX_H / BOX_W
center_z = -0.2 + box_h_units / 2     # small margin under the jar
cam.rotation_euler = (math.pi / 2 - TILT, 0, 0)
cam.location = Vector((0, -10 * math.cos(TILT), center_z + 10 * math.sin(TILT)))


def render(path, w, h):
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
only(jar, rim)
render(os.path.join(ASSETS, "jar.png"), W, Hpx)
only(lid)
render(os.path.join(ASSETS, "lid.png"), W, Hpx)

# Stars: square ortho shots from four angles
only(star)
cam.location = star.location + Vector((0, -10, 0)); cam.rotation_euler = (math.pi / 2, 0, 0)
cam_d.ortho_scale = 1.25
for c in (key, rimL, fill):
    c.constraints[0].target = star
    c.location = star.location + (c.location - Vector((0, 0, 1.3)))
world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.4  # metals need something to reflect
for i, rot in enumerate([(math.radians(90), 0, 0), (math.radians(70), math.radians(20), math.radians(12)),
                         (math.radians(105), math.radians(-25), math.radians(-18)), (math.radians(80), math.radians(35), math.radians(30))]):
    star.rotation_euler = rot
    render(os.path.join(ASSETS, f"star-{i}.png"), 96, 96)

only(jar, rim, lid, star)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "assets.blend"))
