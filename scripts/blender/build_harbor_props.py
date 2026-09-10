"""Build Astraified's original low-poly brass observatory telescope.

Run with Blender 4.5+ (the runtime is a development tool, not a player dependency):
  blender --background --factory-startup --python scripts/blender/build_harbor_props.py

The output is a small, self-contained glTF binary. No third-party assets, image
textures, generated scientific labels, or network access are used by this script.
Coordinates: Z is up in Blender; the GLB exporter converts to glTF Y up.
"""

import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUTPUT = ROOT / "public" / "models" / "harbor-telescope.glb"

bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)


def material(name, color, metallic=0, roughness=0.55):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    bsdf = result.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    return result


BRASS = material("Astraified / aged brass", (0.57, 0.37, 0.14), 0.62, 0.33)
EDGE = material("Astraified / polished brass", (0.82, 0.62, 0.27), 0.7, 0.24)
CEDAR = material("Astraified / painted cedar", (0.12, 0.30, 0.28), 0, 0.78)
DARK = material("Astraified / charcoal fittings", (0.045, 0.075, 0.085), 0.35, 0.5)
GLASS = material("Astraified / blue lens", (0.12, 0.42, 0.49), 0.66, 0.14)


def cylinder_between(name, start, end, radius, mat, vertices=16):
    a, b = Vector(start), Vector(end)
    direction = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=direction.length, location=(a+b)/2)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def ring(name, position, axis, major, minor, mat):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=32, minor_segments=8, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(axis).to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


center = Vector((0, 0, 1.32))
axis = Vector((0.85, 0, 0.53)).normalized()
start, end = center-axis*.67, center+axis*.67

for number, angle in enumerate([0, math.tau/3, 2*math.tau/3]):
    foot = Vector((math.cos(angle)*.52, math.sin(angle)*.52, .07))
    top = Vector((math.cos(angle)*.1, math.sin(angle)*.1, 1.1))
    cylinder_between(f"tripod / cedar leg {number}", foot, top, .049, CEDAR, 8)
    cylinder_between(f"tripod / brass foot {number}", foot-Vector((0,0,.045)), foot+Vector((0,0,.09)), .061, BRASS, 8)
    cylinder_between(f"tripod / brace {number}", (0,0,.52), foot*.57+top*.43, .019, BRASS, 8)

cylinder_between("mount / column", (0,0,.95), (0,0,1.3), .075, DARK)
cylinder_between("mount / hinge", (0,-.22,1.26), (0,.22,1.26), .1, BRASS)
ring("mount / altitude dial", (0,-.24,1.26), (0,1,0), .13, .023, EDGE)
cylinder_between("optics / main brass barrel", start, end, .185, BRASS, 32)
cylinder_between("optics / front lip", end-axis*.06, end+axis*.015, .211, EDGE, 32)
cylinder_between("optics / recessed lens", end+axis*.016, end+axis*.022, .17, GLASS, 32)
cylinder_between("optics / dark eyepiece", start-axis*.22, start, .075, DARK, 24)
cylinder_between("optics / eyepiece brass ring", start-axis*.20, start-axis*.15, .088, EDGE, 24)

for offset in [-.45, .25]:
    ring("optics / decorative barrel band", center+axis*offset, axis, .187, .019, EDGE)
finder_offset = Vector((0,0,.24))
cylinder_between("finder / upper scope", center-axis*.25+finder_offset, center+axis*.4+finder_offset, .045, CEDAR)
for offset in [-.16,.25]:
    c = center+axis*offset
    cylinder_between("finder / support", c+Vector((0,0,.13)), c+finder_offset, .015, EDGE, 8)

for side in [-1,1]:
    cylinder_between("mount / adjustment wheel spindle", (0,side*.2,1.26), (0,side*.31,1.26), .025, DARK)
    ring("mount / knurled adjustment wheel", (0,side*.31,1.26), (0,1,0), .1, .027, EDGE)

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(OUTPUT), export_format="GLB", export_yup=True, export_apply=True, export_cameras=False, export_lights=False)
print(f"Astraified: exported original telescope to {OUTPUT}")

# The hero lighthouse is a second standalone asset. Keep its lantern glass out
# of the export: the deterministic browser simulation owns its light state.
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)

IVORY = material("Astraified / lighthouse ivory", (.79,.69,.49), 0, .78)
CORAL = material("Astraified / lighthouse coral", (.62,.18,.12), 0, .68)
STONE = material("Astraified / blue slate", (.16,.27,.30), 0, .9)
WINDOW = material("Astraified / amber window", (1,.67,.21), 0, .5)
bsdf = WINDOW.node_tree.nodes.get("Principled BSDF")
bsdf.inputs["Emission Color"].default_value = (1,.43,.10,1)
bsdf.inputs["Emission Strength"].default_value = .55


def taper(name, z, height, bottom, top, mat, vertices=32):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=bottom/2, radius2=top/2, depth=height, location=(0,0,z))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def cube(name, position, scale, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=position)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    return obj


taper("lighthouse / twelve-sided basalt plinth",1,.34,3.05,2.8,STONE,12)
taper("lighthouse / lower skirt",1.29,.26,2.2,2.04,IVORY)
taper("lighthouse / ivory masonry",3.77,4.8,1.98,1.25,IVORY)
taper("lighthouse / low coral band",2,.5,1.92,1.84,CORAL)
taper("lighthouse / middle coral band",4.15,.48,1.59,1.51,CORAL)
taper("lighthouse / high coral band",6.21,.2,1.64,1.64,CORAL)
taper("lighthouse / balcony floor",6.34,.18,2.35,2.48,IVORY)
for n in range(24):
    angle=n/24*math.tau
    x,y=math.cos(angle)*1.08,math.sin(angle)*1.08
    cylinder_between("lighthouse / balcony spindle",(x,y,6.38),(x,y,6.89),.022,DARK,8)
ring("lighthouse / upper balcony rail",(0,0,6.88),(0,0,1),1.09,.032,DARK)
ring("lighthouse / lower balcony rail",(0,0,6.52),(0,0,1),1.09,.021,DARK)
taper("lighthouse / lantern lower brass ring",6.5,.13,1.62,1.62,BRASS)
for n in range(8):
    angle=n/8*math.tau
    x,y=math.cos(angle)*.68,math.sin(angle)*.68
    cylinder_between("lighthouse / lantern mullion",(x,y,6.52),(x,y,7.55),.025,BRASS,8)
ring("lighthouse / lantern upper ring",(0,0,7.52),(0,0,1),.7,.048,BRASS)
taper("lighthouse / roof overhang",7.58,.16,1.96,1.96,CORAL)
taper("lighthouse / pointed cap",7.99,.7,1.91,.12,CORAL)
for n in range(16):
    angle=n/16*math.tau
    cylinder_between("lighthouse / copper roof seam",(math.cos(angle)*.96,math.sin(angle)*.96,7.66),(math.cos(angle)*.07,math.sin(angle)*.07,8.36),.011,EDGE,6)
cylinder_between("lighthouse / finial",(0,0,8.33),(0,0,8.66),.024,BRASS,12)
bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=6,radius=.08,location=(0,0,8.53))
bpy.context.object.name="lighthouse / finial ornament"
bpy.context.object.data.materials.append(EDGE)

# A round-topped entrance and tiny masonry details reward a close camera view.
cube("lighthouse / door surround",(0,1.001,1.91),(.75,.08,1.20),IVORY)
cube("lighthouse / teal entrance",(0,1.047,1.84),(.57,.04,1.06),CEDAR)
cylinder_between("lighthouse / round entrance transom",(0,1.03,2.35),(0,1.07,2.35),.285,CEDAR,32)
cube("lighthouse / door lower inset",(0,1.08,1.65),(.42,.027,.49),DARK)
cylinder_between("lighthouse / door brass handle",(.17,1.09,1.83),(.17,1.15,1.83),.042,EDGE,12)
for z,radius in [(3.15,.84),(5.35,.675)]:
    cube("lighthouse / window surround",(0,radius+.017,z),(.38,.07,.70),STONE)
    cube("lighthouse / amber window",(0,radius+.06,z),(.25,.04,.55),WINDOW)
    cube("lighthouse / window crossbar",(0,radius+.085,z),(.26,.028,.036),IVORY)
for x in [-.7,.7]:
    cylinder_between("lighthouse / entry bollard",(x,1.25,1.13),(x,1.25,1.48),.073,BRASS,12)

LIGHTHOUSE_OUTPUT=OUTPUT.with_name("harbor-lighthouse.glb")
bpy.ops.export_scene.gltf(filepath=str(LIGHTHOUSE_OUTPUT), export_format="GLB", export_yup=True, export_apply=True, export_cameras=False, export_lights=False)
print(f"Astraified: exported original lighthouse to {LIGHTHOUSE_OUTPUT}")
