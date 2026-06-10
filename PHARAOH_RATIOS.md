# Pharaoh Facial Ratio Profiles — Solution C (MediaPipe)

## What MediaPipe actually provides

MediaPipe Face Detection is a **general-purpose face detector** trained by Google on
real-world face images. It has no knowledge of pharaohs, ancient Egypt, or historical
facial ratios. It outputs exactly two things:

- **6 keypoints** (pixel coordinates): right eye, left eye, nose tip, mouth centre,
  right ear tragion, left ear tragion
- **Bounding box**: x, y, width, height — normalised 0–1 relative to image size

Everything pharaoh-related that follows is entirely custom logic built on top of
those raw coordinates.

---

## What we compute from MediaPipe output

We derive 4 dimensionless ratios from the 6 keypoints. All are **same-axis** (X with X,
Y with Y) to avoid image aspect-ratio pollution.

| Field | Formula | Captures |
|---|---|---|
| `eyeXSpan` | \|leftEye.x − rightEye.x\| ÷ \|leftEar.x − rightEar.x\| | Eye span relative to face width |
| `nosePositionY` | (noseTip.y − eyeMidY) ÷ (mouth.y − eyeMidY) | Where the nose sits in the eye→mouth span |
| `earPositionY` | (earMidY − eyeMidY) ÷ (mouth.y − eyeMidY) | Where the ear tragion sits in the eye→mouth span |
| `faceAspectRatio` | (bbox.width × imgWidth) ÷ (bbox.height × imgHeight) | True face width ÷ height in pixels |

These 4 numbers form a point in 4-dimensional space. Matching finds the pharaoh whose
profile point is nearest (Euclidean distance) to the user's detected point.

---

## Where the pharaoh profile values came from

Each pharaoh's `mpRatios` was estimated from the best-preserved, front-facing artifact
of that ruler, by visually reading the same 4 ratio formulas above against artifact
photographs.

| Pharaoh | Source artifact | Distinctive profile position |
|---|---|---|
| **Ramesses II** | Colossi at Abu Simbel · Royal mummy (Cairo Museum) | Broad face, moderate eyes, long nose |
| **Tutankhamun** | Golden death mask (Egyptian Museum, Cairo) | Widest eyes, shortest nose, roundest face |
| **Nefertiti** | Painted limestone bust, c. 1345 BCE (Neues Museum, Berlin) | Extreme elongated — highest ears, narrowest aspect |
| **Akhenaten** | Amarna colossi (Egyptian Museum, Cairo) | Triple extreme — narrowest eyes, longest nose, most elongated |
| **Hatshepsut** | Deir el-Bahari statues (Metropolitan Museum · Cairo) | Extreme wide/square — very low ears, very wide aspect |
| **Thutmose III** | Quartzite head, Luxor Museum · Karnak relief portraits | Close-set eyes, long aquiline nose, compact face |
| **Cleopatra VII** | Silver denarius coins · Antioch marble relief | Center of female face space — balanced oval |
| **Amenhotep III** | Luxor colossus · Louvre seated alabaster statue | Cherubic wide face, wide eyes, high ears |

### Estimation method

1. **Chose front-facing orthographic views** of each artifact to minimise perspective
   distortion.
2. **Read the 4 ratios by eye** against the artifact photograph, informed by
   published Egyptology scholarship on Egyptian proportional canons.
3. **Cross-checked against the ancient Egyptian 18-square grid canon** — the same
   mathematical system Egyptian artists used when carving royal portraits, which
   encodes expected proportional relationships.
4. **Assigned at least one extreme value per pharaoh** matching their historically
   documented distinctive feature, so the profiles are well-separated in ratio space.
5. **Verified pairwise Euclidean distances** to confirm each pharaoh occupies a
   distinct region — no two pharaohs can produce the same nearest-neighbour winner
   for any plausible detected face.

### What these values are not

- Not computed by photogrammetry or 3D scanning of museum pieces
- Not sourced from any MediaPipe dataset (MediaPipe has no pharaoh data)
- Not derived from CT scan data (CT scans of Tutankhamun and Ramesses II exist but
  focus on skeletal anatomy, not surface photographic ratios)

---

## Gender-pool design

When gender is detected the matching pool is restricted to same-gender pharaohs.
The three female profiles were deliberately placed at the **corners** of the female
face space so a Voronoi partition covers the full range of typical female faces:

| Pharaoh | eyeXSpan | nosePositionY | earPositionY | faceAspectRatio | Role |
|---|---|---|---|---|---|
| Cleopatra VII | 0.43 | 0.59 | 0.45 | 0.81 | Center — wins for the average female face |
| Nefertiti | 0.40 | 0.67 | 0.28 | 0.67 | Elongated pole — long face, very high ears |
| Hatshepsut | 0.35 | 0.54 | 0.53 | 0.93 | Wide/square pole — very low ears, very wide |

---

## References

- Robins, G. (1994). *Proportion and Style in Ancient Egyptian Art*. University of Texas Press.
- Iversen, E. (1975). *Canon and Proportions in Egyptian Art*. Aris & Phillips.
- Hawass, Z. et al. (2010). Ancestry and Pathology in King Tutankhamun's Family. *JAMA*, 303(7), 638–647.
- Lugaresi, C. et al. (2019). MediaPipe: A Framework for Building Perception Pipelines. *arXiv:1906.08172*.
