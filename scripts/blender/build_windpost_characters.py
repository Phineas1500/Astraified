"""Author Windpost's original characters in Blender 4.5 and export skinned GLBs.

Run with Blender --background --factory-startup --python this_file.py.
No downloaded meshes, textures, or third-party character designs are used.
Blender coordinates: Z up, -Y forward. glTF coordinates: Y up, +Z forward.
"""
from pathlib import Path
import bpy
import math
import json
import struct
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public" / "models" / "windpost"
WORK = ROOT / "artifacts" / "windpost-characters"
OUT.mkdir(parents=True, exist_ok=True)
WORK.mkdir(parents=True, exist_ok=True)
bpy.context.preferences.filepaths.save_version = 0
parts = []
M = {}


def material(name, rgb, roughness=.68, metallic=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    p = mat.node_tree.nodes.get("Principled BSDF")
    p.inputs["Base Color"].default_value = (*rgb, 1)
    p.inputs["Roughness"].default_value = roughness
    p.inputs["Metallic"].default_value = metallic
    return mat


def begin():
    global parts, M
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    parts = []
    colors = {
        "sky": (.16, .58, .77), "sky_light": (.36, .76, .89),
        "ivory": (.97, .93, .79), "eye_white": (1, .98, .89),
        "ink": (.026, .055, .092), "navy": (.055, .105, .19),
        "orange": (1, .32, .055), "orange_light": (1, .52, .12),
        "orange_dark": (.53, .13, .026), "yellow": (1, .69, .055),
        "yellow_light": (1, .83, .17), "yellow_dark": (.64, .38, .022),
        "red": (.72, .10, .12), "red_light": (.96, .24, .20),
        "brown": (.24, .12, .075), "terracotta": (.58, .265, .15),
        "terracotta_light": (.76, .40, .23), "muzzle": (.93, .64, .36),
        "teal": (.055, .38, .36), "teal_light": (.12, .57, .49),
        "brass": (.77, .48, .12), "brass_light": (.99, .73, .26),
        "glass": (.17, .45, .49), "lavender": (.53, .36, .69),
        "lavender_light": (.71, .55, .83), "purple": (.24, .105, .37),
        "purple_light": (.37, .20, .53), "pink": (.95, .43, .42),
    }
    M = {k: material(k, v, .28 if k == "ink" else .68,
                     .5 if "brass" in k else 0) for k, v in colors.items()}


def finish(obj, name, mat, bone="body", smooth=True):
    obj.name = name
    obj.data.materials.append(M[mat])
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    # Bake the authored transform into vertices before adding skin weights.
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    parts.append((obj, bone))
    return obj


def ellipsoid(name, center, scale, mat, bone="body", rotation=None, segments=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=16, location=center)
    obj = bpy.context.object
    obj.scale = scale
    if rotation:
        obj.rotation_euler = rotation
    return finish(obj, name, mat, bone)


def rounded_box(name, center, scale, mat, bone="body", bevel=.04, rotation=None):
    bpy.ops.mesh.primitive_cube_add(size=2, location=center)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if rotation:
        obj.rotation_euler = rotation
    mod = obj.modifiers.new("Soft tailored corners", "BEVEL")
    mod.width = bevel
    mod.segments = 3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return finish(obj, name, mat, bone)


def rod(name, start, end, radius, mat, bone="body", radius2=None):
    a, b = Vector(start), Vector(end)
    d = b-a
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=radius,
        radius2=radius if radius2 is None else radius2,
        depth=d.length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return finish(obj, name, mat, bone)


def ribbon(name, points, width, mat, bone="body"):
    # Round bevelled curve converted to a mesh for reliable skin export.
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = width
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points)-1)
    for p, co in zip(spline.bezier_points, points):
        p.co = co
        p.handle_left_type = "AUTO"
        p.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.convert(target="MESH")
    return finish(bpy.context.object, name, mat, bone)


def eye_pair(z=1.40, x=.165, y=-.29, whites=True, size=1, bone="head"):
    for s, label in [(-1, "L"), (1, "R")]:
        if whites:
            ellipsoid(f"{label} creamy eye surround", (s*x, y, z),
                      (.115*size, .064*size, .137*size), "eye_white", bone)
        ellipsoid(f"{label} expressive pupil", (s*x+.011, y-.057*size, z+.002),
                  (.061*size, .029*size, .083*size), "ink", bone)
        ellipsoid(f"{label} eye catchlight", (s*x-.01, y-.082*size, z+.038*size),
                  (.020*size, .01*size, .025*size), "eye_white", bone, segments=16)
        ellipsoid(f"{label} lower eye glint", (s*x+.033, y-.082*size, z-.025*size),
                  (.009*size, .007*size, .011*size), "sky_light", bone, segments=12)


def bird_beak(z=1.27, size=1, bone="head"):
    ellipsoid("Broad smiling upper beak", (0, -.403, z+.025),
              (.225*size, .235*size, .11*size), "orange_light", bone)
    ellipsoid("Beak smile seam", (0, -.455, z-.027),
              (.19*size, .193*size, .015*size), "orange_dark", bone)
    ellipsoid("Rounded lower beak", (0, -.42, z-.059),
              (.185*size, .192*size, .043*size), "orange", bone)
    for s in [-1, 1]:
        ellipsoid("Nostril", (s*.085*size, -.553, z+.082*size),
                  (.012, .007, .009), "orange_dark", bone, segments=12)


def boots(mat="navy", height=.20, spread=.155):
    for s, side in [(-1, "L"), (1, "R")]:
        bone = "leg_l" if s < 0 else "leg_r"
        rod(f"{side} little leg", (s*spread, 0, .18),
            (s*spread, 0, .48), .043, "orange", bone)
        ellipsoid(f"{side} boot", (s*spread, -.036, height/2),
                  (.12, .17, height/2), mat, bone)
        rounded_box(f"{side} boot sole", (s*spread, -.043, .038),
                    (.116, .145, .035), "ink", bone, bevel=.025)
        ribbon(f"{side} boot cuff", [(s*spread-.067,-.09,.19),
                (s*spread,-.112,.203), (s*spread+.067,-.09,.19)], .014,
                "yellow_light" if mat == "navy" else "brass", bone)


def cape():
    # A thick curved cape with scalloped hem; open at the front for the bib.
    verts, faces = [], []
    steps = 18
    for row in range(5):
        t = row/4
        for i in range(steps+1):
            a = -.10 + (math.pi+.20)*i/steps
            x = (.25+.19*t)*math.cos(a)
            y = .04+(.18+.21*t)*math.sin(a)
            z = 1.15-.51*t + (.025*math.cos(a*6) if row == 4 else 0)
            verts.append((x,y,z))
    for row in range(4):
        for i in range(steps):
            a = row*(steps+1)+i
            faces.append((a,a+1,a+steps+2,a+steps+1))
    mesh = bpy.data.meshes.new("Rain cape mesh")
    mesh.from_pydata(verts, [], faces)
    obj = bpy.data.objects.new("Piper's scalloped rain cape", mesh)
    bpy.context.collection.objects.link(obj)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    sol = obj.modifiers.new("Sewn cape thickness", "SOLIDIFY")
    sol.thickness = .022
    bpy.ops.object.modifier_apply(modifier=sol.name)
    finish(obj, obj.name, "yellow")
    ribbon("Rain cape gold hem", verts[-(steps+1):], .015, "yellow_dark")
    ribbon("Rain cape collar", [(-.26,-.085,1.155),(-.18,-.23,1.125),
        (0,-.285,1.09),(.18,-.23,1.125),(.26,-.085,1.155)], .042,"yellow_light")
    ellipsoid("Cape round clasp", (0,-.321,1.088),(.035,.019,.035),"brass_light")


def piper():
    ellipsoid("Piper pear shaped blue body", (0,0,.80),(.34,.27,.43),"sky")
    ellipsoid("Piper ivory chest bib", (0,-.227,.835),(.233,.069,.30),"ivory")
    ellipsoid("Piper oversized round head", (0,-.026,1.32),(.36,.30,.32),"sky_light","head")
    ellipsoid("Piper ivory face", (0,-.254,1.306),(.274,.093,.238),"ivory","head")
    eye_pair()
    bird_beak()
    for s, side in [(-1,"L"),(1,"R")]:
        ellipsoid(f"{side} soft cheek",(s*.274,-.223,1.27),(.087,.058,.06),"sky","head")
        ribbon(f"{side} curious eyebrow",[(s*.25,-.295,1.51),(s*.18,-.327,1.54),
            (s*.105,-.308,1.53)],.021,"sky","head")
        ellipsoid(f"{side} wing",(s*.337,-.015,.929),(.105,.168,.245),"sky",
            "wing_l" if s<0 else "wing_r",rotation=(0,s*.15,0))
        for i in range(3):
            ellipsoid(f"{side} feather tip {i}",(s*(.335+i*.019),-.031-i*.038,.768+i*.036),
                (.061,.063,.102),"sky_light","wing_l" if s<0 else "wing_r")
    ellipsoid("Piper feather crest large",(-.055,.011,1.624),(.082,.08,.145),"sky","head",rotation=(0,-.35,0))
    ellipsoid("Piper feather crest small",(.059,.035,1.604),(.063,.075,.113),"sky_light","head",rotation=(0,.36,0))
    boots()
    cape()
    # Cross-body satchel wraps over the bib and over the shoulder.
    ribbon("Red satchel shoulder strap",[(-.215,.09,1.14),(-.233,-.13,1.15),
        (-.19,-.283,1.065),(.03,-.319,.88),(.265,-.251,.71)],.026,"brown")
    rounded_box("Piper red mail satchel",(.294,-.151,.655),(.132,.092,.134),"red",bevel=.046,rotation=(0,-.10,-.12))
    rounded_box("Piper satchel flap",(.291,-.239,.713),(.128,.022,.062),"red_light",bevel=.023)
    rounded_box("Piper satchel buckle",(.29,-.266,.687),(.024,.012,.036),"brass_light",bevel=.009)
    rounded_box("Envelope in satchel",(.286,-.146,.805),(.102,.018,.045),"ivory",bevel=.006,rotation=(0,.15,0))
    ribbon("Envelope folded flap",[(.204,-.166,.827),(.285,-.168,.790),(.365,-.166,.827)],.004,"red")
    ellipsoid("Blue tail",(0,.255,.61),(.14,.20,.072),"sky",rotation=(.3,0,0))


def moss():
    ellipsoid("Moss stocky body",(0,.015,.74),(.37,.275,.38),"terracotta")
    ellipsoid("Moss teal vest",(0,-.025,.82),(.357,.274,.29),"teal")
    ellipsoid("Moss warm belly",(0,-.274,.79),(.20,.055,.25),"terracotta_light")
    for s,side in [(-1,"L"),(1,"R")]:
        rounded_box(f"{side} tailored vest panel",(s*.194,-.248,.84),(.102,.064,.22),"teal_light",bevel=.046,rotation=(0,s*.1,s*-.08))
        ribbon(f"{side} vest seam",[(s*.11,-.306,.66),(s*.09,-.321,.86),(s*.13,-.26,1.05)],.009,"brass")
        ellipsoid(f"{side} engineer arm",(s*.361,0,.84),(.109,.148,.263),"terracotta", "wing_l" if s<0 else "wing_r",rotation=(0,s*-.14,0))
        ellipsoid(f"{side} mole paw",(s*.393,-.033,.644),(.112,.11,.10),"terracotta_light","wing_l" if s<0 else "wing_r")
        for i in range(3):
            ellipsoid(f"{side} tiny claw {i}",(s*(.345+i*.047),-.123,.616),(.013,.026,.021),"ivory","wing_l" if s<0 else "wing_r",segments=12)
    ellipsoid("Moss round head",(0,-.017,1.256),(.378,.285,.316),"terracotta_light","head")
    for s,side in [(-1,"L"),(1,"R")]:
        ellipsoid(f"{side} round ear",(s*.326,.015,1.463),(.103,.072,.11),"terracotta","head")
        ellipsoid(f"{side} ear inside",(s*.326,-.045,1.463),(.06,.019,.067),"muzzle","head")
        ellipsoid(f"{side} cheek muzzle",(s*.114,-.28,1.169),(.158,.123,.122),"muzzle","head")
    eye_pair(z=1.35,x=.171,y=-.257,size=.76)
    ellipsoid("Moss broad sensitive nose",(0,-.378,1.261),(.134,.102,.082),"brown","head")
    ellipsoid("Moss nose highlight",(-.035,-.46,1.289),(.032,.01,.013),"terracotta_light","head")
    rounded_box("Moss left tooth",(-.035,-.378,1.081),(.027,.025,.046),"ivory","head",bevel=.009)
    rounded_box("Moss right tooth",(.030,-.378,1.082),(.027,.025,.045),"ivory","head",bevel=.009)
    ribbon("Moss smile",[(-.125,-.369,1.128),(0,-.401,1.104),(.126,-.369,1.128)],.011,"brown","head")
    # Goggles sit on forehead so his real eyes remain visible.
    ribbon("Goggle leather band",[(-.34,-.015,1.448),(-.30,-.19,1.502),(0,-.241,1.511),(.30,-.19,1.502),(.34,-.015,1.448)],.037,"brown","head")
    for s,side in [(-1,"L"),(1,"R")]:
        ellipsoid(f"{side} brass goggle",(s*.155,-.226,1.515),(.124,.073,.101),"brass","head")
        ellipsoid(f"{side} blue goggle lens",(s*.155,-.286,1.525),(.092,.024,.070),"glass","head")
        ribbon(f"{side} goggle glint",[(s*.155-.047,-.31,1.547),(s*.155+.002,-.314,1.577)],.007,"ivory","head")
    rod("Goggle brass bridge",(-.045,-.275,1.519),(.045,-.275,1.519),.022,"brass_light","head")
    boots(mat="brown",spread=.18)
    ribbon("Moss leather tool belt",[(-.31,-.132,.641),(-.22,-.263,.621),(0,-.309,.613),(.22,-.263,.621),(.31,-.132,.641)],.041,"brown")
    rounded_box("Tool belt buckle",(0,-.351,.622),(.047,.016,.043),"brass_light",bevel=.009)
    rounded_box("Tool belt pouch",(-.30,-.16,.59),(.074,.058,.097),"brown",bevel=.023)
    rod("Spanner shaft",(.305,-.221,.55),(.322,-.20,.775),.025,"brass_light")
    for s in [-1,1]:
        rod("Spanner fork",(.322+s*.013,-.2,.756),(.322+s*.041,-.2,.802),.023,"brass_light")
    ellipsoid("Moss broad beaver tail",(0,.329,.37),(.24,.29,.074),"terracotta",rotation=(.18,0,0))
    for x in [-.12,0,.12]:
        ribbon("Tail woven ridge",[(x,.24,.432),(x,.43,.443),(x*.7,.54,.419)],.01,"brown")


def bea():
    ellipsoid("Bea round lavender body",(0,.025,.77),(.405,.295,.403),"lavender")
    ellipsoid("Bea creamy belly",(0,-.235,.82),(.29,.073,.292),"ivory")
    ellipsoid("Bea round head",(0,-.03,1.285),(.385,.308,.321),"lavender_light","head")
    ellipsoid("Bea white heart face",(0,-.258,1.31),(.29,.091,.246),"eye_white","head")
    eye_pair(z=1.397,x=.164,y=-.303,size=.9)
    bird_beak(z=1.265,size=.88)
    for s,side in [(-1,"L"),(1,"R")]:
        ellipsoid(f"{side} Bea blush",(s*.25,-.297,1.29),(.053,.019,.034),"pink","head")
        ribbon(f"{side} Bea eyebrow",[(s*.245,-.291,1.493),(s*.18,-.327,1.514),(s*.114,-.315,1.50)],.016,"purple","head")
        ellipsoid(f"{side} Bea wing",(s*.377,.011,.869),(.109,.164,.236),"lavender","wing_l" if s<0 else "wing_r",rotation=(0,s*.19,0))
        for i in range(2):
            ellipsoid(f"{side} Bea feather tip {i}",(s*(.386+i*.018),-.02-i*.041,.716+i*.037),(.058,.056,.093),"lavender_light","wing_l" if s<0 else "wing_r")
    boots(mat="purple",spread=.17)
    ellipsoid("Bea purple postmaster cap",(0,-.005,1.568),(.322,.278,.095),"purple","head",rotation=(0,-.12,0))
    ellipsoid("Bea cap tilted crown",(-.035,.015,1.62),(.26,.236,.075),"purple_light","head",rotation=(0,-.13,0))
    ellipsoid("Bea cap peak",(0,-.269,1.57),(.254,.151,.026),"purple","head")
    rounded_box("Bea cap mail badge",(0,-.268,1.659),(.06,.015,.044),"brass_light","head",bevel=.012)
    ribbon("Cap badge envelope",[(-.042,-.287,1.681),(0,-.291,1.645),(.042,-.287,1.681)],.005,"purple","head")
    ribbon("Bea postmaster collar",[(-.245,-.117,1.1),(-.15,-.264,1.059),(0,-.295,1.045),(.15,-.264,1.059),(.245,-.117,1.1)],.028,"purple")
    ellipsoid("Bea necktie knot",(0,-.324,1.04),(.031,.022,.036),"purple_light")
    rounded_box("Bea necktie",(0,-.304,.946),(.041,.022,.085),"purple",bevel=.018,rotation=(0,.04,0))
    rounded_box("Bea postal name badge",(-.149,-.301,.88),(.065,.011,.036),"brass_light",bevel=.007)
    rod("Bea badge ink line",(-.19,-.316,.884),(-.11,-.316,.884),.004,"purple")
    ellipsoid("Bea tail",(0,.279,.605),(.177,.192,.068),"lavender",rotation=(.24,0,0))


def build_rig(name):
    # Normalize all meshes together, preserving true feet-on-ground rest pose.
    low = min(v.co.z for obj,_ in parts for v in obj.data.vertices)
    high = max(v.co.z for obj,_ in parts for v in obj.data.vertices)
    factor = 1.65 / (high-low)
    for obj,_ in parts:
        for vertex in obj.data.vertices:
            vertex.co.z -= low
            vertex.co *= factor
    arm = bpy.data.armatures.new(name+" skeleton")
    rig = bpy.data.objects.new(name+" rig", arm)
    bpy.context.collection.objects.link(rig)
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.object.mode_set(mode="EDIT")
    definitions = [
        ("root",(0,0,0),(0,0,.25),None),
        ("body",(0,0,.64),(0,0,1.04),"root"),
        ("head",(0,0,1.12),(0,0,1.43),"body"),
        ("wing_l",(-.295,0,1.04),(-.39,0,.75),"body"),
        ("wing_r",(.295,0,1.04),(.39,0,.75),"body"),
        ("leg_l",(-.16,0,.44),(-.16,0,.12),"root"),
        ("leg_r",(.16,0,.44),(.16,0,.12),"root"),
    ]
    for bname,start,end,parent in definitions:
        bone = arm.edit_bones.new(bname)
        bone.head = (Vector(start)-Vector((0,0,low)))*factor
        bone.tail = (Vector(end)-Vector((0,0,low)))*factor
        if parent:
            bone.parent = arm.edit_bones[parent]
        bone.use_deform = True
    bpy.ops.object.mode_set(mode="OBJECT")
    for obj,bone in parts:
        group = obj.vertex_groups.new(name=bone)
        group.add(list(range(len(obj.data.vertices))),1.0,"REPLACE")
        obj.parent = rig
        mod = obj.modifiers.new("Windpost skeleton skin","ARMATURE")
        mod.object = rig
    for bone in rig.pose.bones:
        bone.rotation_mode = "XYZ"
    return rig


def batch_by_material():
    """Join same-material parts, preserving vertex groups and the armature skin."""
    global parts
    batches = {}
    for obj,_ in parts:
        batches.setdefault(obj.data.materials[0].name, []).append(obj)
    combined = []
    for mat, objects in batches.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        if len(objects)>1:
            bpy.ops.object.join()
        obj=bpy.context.object
        obj.name="Skinned "+mat+" details"
        combined.append((obj,None))
    parts=combined


def animate(rig, name, duration, fn):
    rig.animation_data_create()
    action = bpy.data.actions.new(name)
    rig.animation_data.action = action
    fps = 24
    frames = int(duration*fps)
    for frame in range(0,frames+1,3):
        t = frame/frames
        for bone in rig.pose.bones:
            bone.location = (0,0,0)
            bone.rotation_euler = (0,0,0)
            bone.scale = (1,1,1)
        fn(rig.pose.bones,t)
        for bone in rig.pose.bones:
            bone.keyframe_insert("location",frame=frame)
            bone.keyframe_insert("rotation_euler",frame=frame)
            bone.keyframe_insert("scale",frame=frame)
    track = rig.animation_data.nla_tracks.new()
    track.name = name
    strip = track.strips.new(name,0,action)
    strip.action_frame_start=0
    strip.action_frame_end=frames
    rig.animation_data.action = None
    track.mute = True
    return action


def idle(b,t):
    wave = math.sin(t*math.tau)
    b["body"].location.y = .014*wave
    b["head"].rotation_euler[1] = .035*wave
    b["head"].rotation_euler[2] = .025*math.sin(t*math.tau+1)
    b["wing_l"].rotation_euler[2] = .025*wave
    b["wing_r"].rotation_euler[2] = -.025*wave


def walk(b,t):
    wave = math.sin(t*math.tau)
    b["leg_l"].rotation_euler[0] = .50*wave
    b["leg_r"].rotation_euler[0] = -.50*wave
    b["body"].location.y = .024*abs(wave)
    b["body"].rotation_euler[2] = .025*wave
    b["head"].rotation_euler[2] = -.025*wave
    b["wing_l"].rotation_euler[0] = -.27*wave
    b["wing_r"].rotation_euler[0] = .27*wave


def jump(b,t):
    lift = math.sin(t*math.pi)
    b["body"].rotation_euler[0] = -.07*lift
    b["wing_l"].rotation_euler[2] = -.80*lift
    b["wing_r"].rotation_euler[2] = .80*lift
    b["leg_l"].rotation_euler[0] = -.38*lift
    b["leg_r"].rotation_euler[0] = -.29*lift
    b["head"].rotation_euler[0] = .08*lift


def carry(b,t):
    idle(b,t)
    b["wing_l"].rotation_euler[0] = -.86
    b["wing_r"].rotation_euler[0] = -.86
    b["wing_l"].rotation_euler[2] = -.34
    b["wing_r"].rotation_euler[2] = .34
    b["head"].rotation_euler[0] = -.065


def carry_walk(b,t):
    # Retain walk's leg stride and body cadence while the wings cradle cargo.
    walk(b,t)
    b["wing_l"].rotation_euler[0] = -.86
    b["wing_r"].rotation_euler[0] = -.86
    b["wing_l"].rotation_euler[2] = -.34
    b["wing_r"].rotation_euler[2] = .34
    b["head"].rotation_euler[0] = -.065


def render(name, rig):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 32
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 800
    scene.render.resolution_y = 900
    scene.render.resolution_percentage = 100
    scene.world.color = (.22,.22,.22)
    scene.view_settings.view_transform = "AgX"
    backdrop = material("Warm studio floor",(.31,.39,.40))
    bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.006))
    floor = bpy.context.object
    floor.data.materials.append(backdrop)
    for label, loc, energy, size in [
        ("Large warm key",(-3,-4,5),400,4),
        ("Soft front fill",(3,-2,3),220,3),
        ("Cape rim",(1,3,4),500,3)]:
        bpy.ops.object.light_add(type="AREA",location=loc)
        light = bpy.context.object
        light.name = label
        light.data.energy=energy
        light.data.shape="DISK"
        light.data.size=size
        light.rotation_euler = (Vector((0,0,.9))-light.location).to_track_quat("-Z","Y").to_euler()
    bpy.ops.object.camera_add(location=(2.35,-4.5,2.05))
    cam=bpy.context.object
    cam.rotation_euler=(Vector((0,0,.86))-cam.location).to_track_quat("-Z","Y").to_euler()
    cam.data.type="ORTHO"
    cam.data.ortho_scale=2.22
    scene.camera=cam
    scene.render.image_settings.file_format="PNG"
    scene.render.filepath=str(WORK/(name+"-studio.png"))
    bpy.ops.wm.save_as_mainfile(filepath=str(WORK/(name+".blend")))
    bpy.ops.render.render(write_still=True)


def export_character(name, author):
    begin()
    author()
    rig=build_rig(name)
    batch_by_material()
    animate(rig,"idle",2.0,idle)
    if name == "piper":
        animate(rig,"walk",1.0,walk)
        animate(rig,"jump",.75,jump)
        animate(rig,"carry",2.0,carry)
        animate(rig,"carry_walk",1.0,carry_walk)
    # Export all NLA tracks as separate clips. Unmute for exporter discovery;
    # reset after export so the authoring file/studio render shows rest pose.
    for track in rig.animation_data.nla_tracks:
        track.mute=False
    bpy.context.scene.render.fps=24
    bpy.context.scene.frame_start=0
    bpy.context.scene.frame_end=48
    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj,_ in parts:
        obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(OUT/(name+".glb")),
        export_format="GLB",use_selection=True,export_yup=True,
        export_animations=True,export_animation_mode="NLA_TRACKS",
        export_nla_strips=True,export_skins=True,export_all_influences=False,
        export_apply=False,export_materials="EXPORT",export_cameras=False,
        export_lights=False,export_extras=True)
    for track in rig.animation_data.nla_tracks:
        track.mute=True
    for bone in rig.pose.bones:
        bone.location=(0,0,0)
        bone.rotation_euler=(0,0,0)
        bone.scale=(1,1,1)
    bpy.context.scene.frame_set(0)
    data=(OUT/(name+".glb")).read_bytes()
    length=struct.unpack_from("<I",data,12)[0]
    gltf=json.loads(data[20:20+length])
    animations=[a.get("name") for a in gltf.get("animations",[])]
    skins=gltf.get("skins",[])
    skinned=sum(1 for mesh in gltf.get("meshes",[]) for p in mesh["primitives"]
                if "JOINTS_0" in p["attributes"] and "WEIGHTS_0" in p["attributes"])
    triangles=sum(gltf["accessors"][p["indices"]]["count"]//3
                  for mesh in gltf["meshes"] for p in mesh["primitives"])
    expected=["idle","walk","jump","carry","carry_walk"] if name=="piper" else ["idle"]
    assert set(animations)==set(expected),(name,animations)
    assert skins and skinned>0,(name,"No skin exported")
    result={"file":name+".glb","bytes":len(data),"height":1.65,
        "forward":"+Z","up":"+Y","feetY":0,"animations":animations,
        "skins":len(skins),"joints":len(skins[0]["joints"]),
        "skinnedPrimitives":skinned,"meshCount":len(gltf.get("meshes",[])),
        "triangles":triangles,
        "authoring":"Original geometry, materials, skeleton and clips authored by build_windpost_characters.py in Blender 4.5.0"}
    print("WINDPOST_EXPORT",json.dumps(result))
    render(name,rig)
    return result


results=[export_character("piper",piper),export_character("moss",moss),export_character("bea",bea)]
(OUT/"manifest.json").write_text(json.dumps({"characters":results},indent=2)+"\n")
print("WINDPOST_ASSETS_COMPLETE",OUT)
