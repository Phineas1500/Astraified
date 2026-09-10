# Bramble Bay art direction

Generated 2026-09-10 for Astraified's first point-and-click episode, *The Last Light at Bramble Bay*.

## Production method

All six backgrounds are original images produced with the built-in `image_gen` tool, one generation call per room. The jetty established the style. Each subsequent image used the jetty as a style and palette reference while requesting a different interior. No external franchise art was supplied. No CLI/API fallback, image manipulation scripts, or installs were used. Final selected PNGs were copied into the project; generated originals were retained.

Every output was inspected directly in the image tool result, then its dimensions were checked using `sips`. The plates share a 1672 × 941 landscape canvas (approximately 16:9), dark ink contours, painted cel shading, warm timber and brass, teal walls and water, and coral twilight. The finished rendering is somewhat more detailed and painterly than the initial chunky-cartoon brief. Character and interactive-object overlays should use dark outlines, muted warm highlights, and a grounding shadow to belong in the same world.

## Assets and placement

All coordinates are approximate fractions of the full image, measured from its top-left corner. These are visual integration guides, not collision geometry or validated hotspot polygons. Character feet can occupy roughly y76–86%, with heads higher in the clear room area. Maintain the image aspect ratio and map hotspots to the same logical scene coordinates.

| File under public/adventure | Dimensions | Observed composition / integration |
| --- | --- | --- |
| jetty.png | 1672 × 941 | Open wharf lower half; houses at left; distant ferry around (0.47, 0.30); lighthouse around (0.92, 0.21). Put captain in clear central/right foreground. Primary lighthouse lens appears dark. |
| tearoom.png | 1672 × 941 | Counter at left; broad harbor window rear; open center floor; tables tucked rear and right. Space for proprietor around x0.60. |
| workshop.png | 1672 × 941 | Bench across left/back; tools above; round window rear-right; stove far-right; open floor in center. Overlay portable lamp on foreground-left work area or a deliberate object close-up. |
| storeroom.png | 1672 × 941 | Crates frame edges; cupboard rear-left; open shelving rear-right. Empty lower-right cubby spans approximately x0.73–0.84, y0.40–0.53; item can be placed within. |
| signalhouse.png | 1672 × 941 | Large brass hatch spans approximately x0.13–0.47, y0.12–0.55; dark cabinet near rear-center; windows right. Robot belongs in clear right-center foreground. |
| lantern.png | 1672 × 941 | Unlit beacon spans approximately x0.40–0.60, y0.03–0.54; curved windows and wide open foreground. A separate glow/light beam can represent the repaired state. |

These background images intentionally contain no baked-in UI, labels, main characters, educational diagrams, loose quest items, or evidence text. Background tools, cups, ropes, and other scenery are decorative unless the game explicitly assigns a hotspot. Interactive items should have clearer silhouettes and sufficient contrast to avoid pixel hunting.

### Integration notes

- The small lighthouse seen through the tearoom and workshop windows contains a warm dot inside its lantern. Avoid reading that tiny painted detail as reliable game state. The main jetty lighthouse and the lantern-room beacon are dark. If story logic requires every distant beacon depiction to change, generate state-specific variants or obscure the small window beacon with a coherent game overlay.
- The signalhouse hatch is especially prominent. Use its actual painted bounds for interaction rather than putting a separate competing hatch in the foreground.
- The storeroom's empty cubby was preserved deliberately for the lost record or keepsake sprite. Keep that object outside the background asset so pickup visibly changes the room.
- The lantern-room image depicts its beacon before repair. Its lit state requires a runtime visual change.
- Files are original PNG outputs, about 2.1–2.4 MB each. No lossy postprocessing was applied. All six together are roughly 14 MB; preload the next room or show a coherent loading transition.

## Exact generation prompts

### jetty.png

Repository path: `public/adventure/jetty.png`.

Original generation identifier (local output, not included in this repository): `generated_images/01a08c01-abb4-77a2-abd5-8b0b89abde38/exec-ddc1e9ff-5326-43be-9845-ba420959885b.png`.

No input reference image.

```text
Use case: illustration-story. Asset type: finished background plate for an original point-and-click adventure video game, Bramble Bay. Create a full-bleed 16:9 landscape illustration, ideally 1536x864. FIRST-PERSON viewpoint at human eye level on a wooden harbor jetty at twilight, looking along broad planked wharf toward the quiet water; absolutely not isometric and not a diorama. Style: charming hand-drawn 2D cartoon adventure, confident warm charcoal ink contours, clear chunky readable shapes, restrained cel shading with subtle paper grain, teal/seafoam/coral/mustard palette. Attractive professional game environment with cozy humorous nautical details. Scene: broad spacious wooden wharf fills lower 55%, teal twilight water in the middle distance, small distant ferry off the left middle, cluster of cozy crooked harbor houses along left rear shore, round red-and-white lighthouse on the right rocky headland, lighthouse lamp is dark, lilac clouds and pale warm dusk horizon. Frame edges with rope bollards, coiled ropes and small seaweed details. Composition must leave the central foreground and specifically area at x65% y65% uncluttered for separately rendered character sprites. Keep architecture and major details around back/top and side edges. No characters, creatures, people, foreground boats, interface, text, signs with writing, letters, labels, numbers, watermarks or borders. This is background scenery only, not a screenshot with UI. Compelling polished storybook cartoon harbor adventure artwork with clear depth and strong visual hierarchy.
```

### tearoom.png

Repository path: `public/adventure/tearoom.png`.

Original generation identifier (local output, not included in this repository): `generated_images/01a08c01-abb4-77a2-abd5-8b0b89abde38/exec-cc70ae37-9c18-486a-911f-0cab594e5260.png`.

Style reference: `public/adventure/jetty.png`.

```text
Use case: illustration-story. Asset type: finished background plate for original point-and-click adventure Bramble Bay. Input image is STYLE AND PALETTE REFERENCE ONLY. Create an entirely different scene described below, matching the reference's charming illustrated cartoon adventure rendering, warm dark-ink contours, confident readable chunky shapes, restrained painted cel shading and subtle paper texture. Fullbleed 16:9 landscape ideally same 1672x941 aspect. Eye-level first-person room view with deep foreground, NOT isometric, NOT a diorama. Twilight teal/seafoam/coral/mustard and warm amber light palette. No people, animals, characters, text, labels, signs with writing, UI, captions, border or watermark. Scene architecture and props should favor room perimeter and upper half, leaving spacious central foreground floor for separately rendered characters and collectables. Crisp professional game environment, cozy and inviting but a little mysterious. Scene: a cozy little seaside tearoom. Counter along left edge, curved wooden counter front, kettle and cups tucked into backcounter, crooked shelving behind. Broad central back-wall window shows muted teal harbor and distant twilight sky, cool dusk contrasts with warm indoor pendant lamps. A few small empty tables and mismatched stools kept at room edges, low wood paneling with seafoam walls and warm honey floorboards. A gently eccentric teapot collection and nautical wall decoration with no writing. Keep central floor and x60% y65% entirely clear for a puffin proprietor sprite. Entire room is seen at eye level, floor taking lower 40%. Do not depict any character or added speech/UI.
```

### workshop.png

Repository path: `public/adventure/workshop.png`.

Original generation identifier (local output, not included in this repository): `generated_images/01a08c01-abb4-77a2-abd5-8b0b89abde38/exec-39e04970-70c9-409a-bbb4-a1e9b881c52e.png`.

Style reference: `public/adventure/jetty.png`.

```text
Use case: illustration-story. Asset type: finished background plate for original point-and-click adventure Bramble Bay. Input image is STYLE AND PALETTE REFERENCE ONLY. Create an entirely different scene described below, matching the reference's charming illustrated cartoon adventure rendering, warm dark-ink contours, confident readable chunky shapes, restrained painted cel shading and subtle paper texture. Fullbleed 16:9 landscape ideally same 1672x941 aspect. Eye-level first-person room view with deep foreground, NOT isometric, NOT a diorama. Twilight teal/seafoam/coral/mustard and warm amber light palette. No people, animals, characters, text, labels, signs with writing, UI, captions, border or watermark. Scene architecture and props should favor room perimeter and upper half, leaving spacious central foreground floor for separately rendered characters and collectables. Crisp professional game environment, cozy and inviting but a little mysterious. Scene: an eccentric harbor engineer's workshop, warm inviting tinkering room under slanted timber rafters. Broad waist-height workbench across left/back with simple chunky unlabeled spare parts, brass lamp fittings, heavy teal tool pegboard and silhouettes of handtools, little round seaside window right. Warm desk lamp and late twilight entering window. Rich timber, matte painted teal cabinets, brass and copper. A clear empty workspace surface at left-mid foreground can receive a separately drawn unlit lamp casing. Keep center floor and x63% y66% clear for engineer sprite. Cabinets and machinery remain mostly upper/back and edges. Playful visual details: a wonky stack of empty tin boxes and a kettle tucked on upper shelf. Avoid legible instrument dials or circuit diagrams; those are added by the game.
```

### storeroom.png

Repository path: `public/adventure/storeroom.png`.

Original generation identifier (local output, not included in this repository): `generated_images/01a08c01-abb4-77a2-abd5-8b0b89abde38/exec-f0e74cae-2857-4578-90c2-da2c6e62ac36.png`.

Style reference: `public/adventure/jetty.png`.

```text
Use case: illustration-story. Asset type: finished background plate for original point-and-click adventure Bramble Bay. Input image is STYLE AND PALETTE REFERENCE ONLY. Create an entirely different indoor scene described below, matching the reference's charming illustrated cartoon adventure rendering, warm dark-ink contours, confident readable chunky shapes, restrained painted cel shading and subtle paper texture. Fullbleed 16:9 landscape ideally same 1672x941 aspect. Eye-level first-person room view with deep foreground, NOT isometric, NOT a diorama. Twilight teal/seafoam/coral/mustard and warm amber light palette. No people, animals, characters, text, labels, signs with writing, UI, captions, border or watermark. Scene architecture and props should favor room perimeter and upper half, leaving spacious central foreground floor for separately rendered characters and collectables. Crisp professional game environment, cozy and inviting but a little mysterious. Scene: a narrow harborside storeroom with stacked uneven wooden crates along both edges, tall old seafoam narrow cupboards at rear, nautical oddments, folded canvas, neatly coiled rope, cork floats, empty glass jars and a life ring. A clearly visible EMPTY low rectangular cupboard cubby occupies the right at around x77% y53%, large enough to hide a small record or keepsake that will be rendered separately. Keep the entire central floor clear. Small high frosted window admits dusky violet light, amber wall lantern left casts pools of cozy light, shadowy humorous clutter confined to shelves and sides. Do not place any loose puzzle objects in the empty cubby. Do not show outside lighthouse.
```

### signalhouse.png

Repository path: `public/adventure/signalhouse.png`.

Original generation identifier (local output, not included in this repository): `generated_images/01a08c01-abb4-77a2-abd5-8b0b89abde38/exec-0100b102-2bc6-4124-9330-fe26fde964d4.png`.

Style reference: `public/adventure/jetty.png`.

```text
Use case: illustration-story. Asset type: finished background plate for original point-and-click adventure Bramble Bay. Input image is STYLE AND PALETTE REFERENCE ONLY. Create an entirely different indoor scene described below, matching the reference's charming illustrated cartoon adventure rendering, warm dark-ink contours, confident readable chunky shapes, restrained painted cel shading and subtle paper texture. Fullbleed 16:9 landscape ideally same 1672x941 aspect. Eye-level first-person room view with deep foreground, NOT isometric, NOT a diorama. Twilight teal/seafoam/coral/mustard and warm amber light palette. No people, animals, characters, text, labels, signs with writing, UI, captions, border or watermark. Scene architecture and props should favor room perimeter and upper half, leaving spacious central foreground floor for separately rendered characters and collectables. Crisp professional game environment, cozy and inviting but a little mysterious. Scene: the inside of a little harbor signal maintenance hut, squat rounded timber architecture. A LARGE CLOSED RECTANGULAR BRASS SERVICE HATCH with rounded corners and visible hinges fills left-back wall from about x12% to x42% and y28% to y62%; it is simple and has a chunky round mechanical handle and absolutely no writing. Heavy dark insulated cables route along upper wall, never a labeled circuit schematic. A dark recessed maintenance cabinet on right-back wall; tools and panels remain vague unlabeled scenery. Muted cool teal sea-facing windows across upper-right, warm practical lamp at upper-left, wooden floor. Leave spacious clear floor central/right x67% y67% for a small robot sprite. Service hatch is main interactive architecture and must be easy to read. No robot, no foreground device, no person, no technical diagrams.
```

### lantern.png

Repository path: `public/adventure/lantern.png`.

Original generation identifier (local output, not included in this repository): `generated_images/01a08c01-abb4-77a2-abd5-8b0b89abde38/exec-19b19f24-f93f-4e31-807d-543f831f97ac.png`.

Style reference: `public/adventure/jetty.png`.

```text
Use case: illustration-story. Asset type: finished background plate for original point-and-click adventure Bramble Bay. Input image is STYLE AND PALETTE REFERENCE ONLY. Create an entirely different indoor scene described below, matching the reference's charming illustrated cartoon adventure rendering, warm dark-ink contours, confident readable chunky shapes, restrained painted cel shading and subtle paper texture. Fullbleed 16:9 landscape ideally same 1672x941 aspect. Eye-level first-person room view with deep foreground, NOT isometric, NOT a diorama. Twilight teal/seafoam/coral/mustard and warm amber light palette. No people, animals, characters, text, labels, signs with writing, UI, captions, border or watermark. Scene architecture and props should favor room perimeter and upper half, leaving spacious central foreground floor for separately rendered characters and collectables. Crisp professional game environment, cozy and inviting but a little mysterious. Scene: the lighthouse's upper lantern room, a broad circular chamber with curved tall windows across the upper/back wall showing darkening purple and blue twilight sea, isolated distant coastline. A large elegant UNLIT brass lighthouse lantern apparatus at center-back, all glass and lens surfaces are dark cool teal, with a broad sturdy pedestal; NO glowing bulb or lightbeam. Brass-and-darkmetal frame and thick clear curved windows create the unique architectural silhouette. Wide clear wooden working floor spans lower half; low built-in side cupboards hold nondescript tools, the final wiring mechanism will be a separate game overlay. A small ordinary warm oil lamp on left wall illuminates room modestly but central beacon stays entirely UNLIT. First-person eye-level wide interior. Leave ample uncluttered front-center and front-right space for the player interacting and other separately rendered objects. No writing or diagrams.
```


