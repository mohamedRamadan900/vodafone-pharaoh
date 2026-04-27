// ─── Facial ratio profile ──────────────────────────────────────────────────
// Each value is a ratio of one facial measurement to another,
// derived from depictions in sculptures, masks, and archaeological evidence.
export interface FacialRatioProfile {
  eyeSpanToFace:    number;   // inter-ocular distance / face width
  noseWidthToFace:  number;   // nose width / face width
  mouthWidthToFace: number;   // mouth width / face width
  jawToFace:        number;   // inner jaw width / outer jaw width
  noseLengthNorm:   number;   // nose length / lower-face height
  mouthChinNorm:    number;   // mouth-centre-to-chin / lower-face height
}

// ─── MediaPipe-specific profile (only 6 keypoints + bounding box) ─────────
// Same-axis ratios are immune to image aspect ratio.
// faceAspectRatio uses pixel dimensions so it is also aspect-ratio corrected.
export interface MediaPipeRatioProfile {
  // |leftEye.x − rightEye.x| / |leftEar.x − rightEar.x|       (pure X)
  // How wide-set the eyes are relative to face width.   Typical: 0.33 – 0.49
  eyeXSpan:        number;
  // (noseTip.y − eyeMidY) / (mouth.y − eyeMidY)               (pure Y)
  // Where the nose sits in the eye→mouth span.          Typical: 0.51 – 0.68
  nosePositionY:   number;
  // ((leftEar.y+rightEar.y)/2 − eyeMidY) / (mouth.y − eyeMidY) (pure Y)
  // Ear tragion height within the eye→mouth span.       Typical: 0.24 – 0.54
  earPositionY:    number;
  // (bbox.width × imgW) / (bbox.height × imgH)                 (pixel-corrected)
  // True face width / height in pixels. Round=0.88-0.93, elongated=0.64-0.73
  faceAspectRatio: number;
}

// ─── Pharaoh definition ───────────────────────────────────────────────────
export interface PharaohProfile {
  id:          string;
  name:        string;
  dynasty:     string;
  reign:       string;
  title:       string;
  description: string;
  traits:      string[];
  emoji:       string;
  accentColor: string;
  imageUrl:    string;   // path relative to src/assets/pharaohs/
  gender:      'male' | 'female';
  // Ratio profiles used by the matching algorithms
  ratios:      FacialRatioProfile;
  mpRatios:    MediaPipeRatioProfile;
}

// ─── Match result returned by each solver ─────────────────────────────────
export interface PharaohMatch {
  pharaoh:    PharaohProfile;
  similarity: number;                    // 0 – 100 integer
  confidence: 'Low' | 'Medium' | 'High';
  features?:  string[];                  // human-readable matched features
  rawText?:   string;                    // Claude's raw explanation (Tab 2)
}

// ─── Pharaoh data ─────────────────────────────────────────────────────────
// Ratios are calibrated from famous artefacts:
// Tutankhamun's golden mask, Nefertiti's Berlin bust, Ramesses II's mummy & colossus, etc.
export const PHARAOHS: PharaohProfile[] = [
  {
    id: 'ramesses-ii',
    name: 'Ramesses II',
    dynasty: '19th Dynasty',
    reign: '1279 – 1213 BCE',
    title: 'Ramesses the Great',
    description:
      'One of Egypt\'s most powerful and celebrated pharaohs. His reign of 66 years ' +
      'saw epic battles, monumental construction, and a legendary harem of over 200 wives.',
    traits: ['Dominant jaw', 'Hooked aquiline nose', 'High cheekbones', 'Commanding presence'],
    emoji: '👑',
    accentColor: '#d4a847',
    imageUrl: 'assets/pharaohs/ramesses-ii.jpg',
    gender: 'male',
    // Signature: broadest nose + highest jaw (wide powerful face)
    ratios: { eyeSpanToFace: 0.44, noseWidthToFace: 0.28, mouthWidthToFace: 0.35, jawToFace: 0.93, noseLengthNorm: 0.51, mouthChinNorm: 0.22 },
    // Broad face, moderate eyes, long nose, mid aspect
    mpRatios: { eyeXSpan: 0.41, nosePositionY: 0.65, earPositionY: 0.43, faceAspectRatio: 0.80 },
  },
  {
    id: 'tutankhamun',
    name: 'Tutankhamun',
    dynasty: '18th Dynasty',
    reign: '1332 – 1323 BCE',
    title: 'The Boy King',
    description:
      'The young pharaoh who died at around 18 years of age. His undisturbed tomb, ' +
      'discovered in 1922, became the greatest archaeological find of the 20th century.',
    traits: ['Large almond eyes', 'Soft oval face', 'Full lips', 'Rounded chin'],
    emoji: '🏺',
    accentColor: '#c9a84c',
    imageUrl: 'assets/pharaohs/tutankhamun.jpg',
    gender: 'male',
    // Signature: widest eye span + fullest mouth + short nose (youthful rounded face)
    ratios: { eyeSpanToFace: 0.53, noseWidthToFace: 0.18, mouthWidthToFace: 0.42, jawToFace: 0.84, noseLengthNorm: 0.37, mouthChinNorm: 0.30 },
    // Widest eyes, shortest nose, roundest face, highest aspect
    mpRatios: { eyeXSpan: 0.49, nosePositionY: 0.51, earPositionY: 0.54, faceAspectRatio: 0.93 },
  },
  {
    id: 'nefertiti',
    name: 'Nefertiti',
    dynasty: '18th Dynasty',
    reign: 'c. 1353 – 1336 BCE',
    title: 'The Beautiful One Has Come',
    description:
      'Great Royal Wife of Akhenaten, renowned across the ancient world for her beauty. ' +
      'The painted limestone bust of Nefertiti is one of the most copied works of ancient art.',
    traits: ['Elongated swan neck', 'High cheekbones', 'Almond eyes', 'Sharp jawline'],
    emoji: '👸',
    accentColor: '#5b8fc9',
    imageUrl: 'assets/pharaohs/nefertiti.jpg',
    gender: 'female',
    // Signature: narrowest nose + narrow jaw (refined sculpted features)
    ratios: { eyeSpanToFace: 0.47, noseWidthToFace: 0.16, mouthWidthToFace: 0.34, jawToFace: 0.80, noseLengthNorm: 0.47, mouthChinNorm: 0.26 },
    // Refined, slightly elongated, narrow — high ears
    mpRatios: { eyeXSpan: 0.39, nosePositionY: 0.62, earPositionY: 0.31, faceAspectRatio: 0.70 },
  },
  {
    id: 'akhenaten',
    name: 'Akhenaten',
    dynasty: '18th Dynasty',
    reign: '1353 – 1336 BCE',
    title: 'The Heretic Pharaoh',
    description:
      'The revolutionary pharaoh who abolished the traditional Egyptian polytheistic religion ' +
      'and introduced monotheistic worship of the sun disc Aten — a radical transformation ' +
      'that was reversed after his death.',
    traits: ['Elongated face', 'Narrow deep-set eyes', 'Full prominent lips', 'Weak receding chin'],
    emoji: '☀️',
    accentColor: '#e87c3e',
    imageUrl: 'assets/pharaohs/akhenaten.jpg',
    gender: 'male',
    // Signature: narrowest eye span + longest nose + narrowest jaw (most elongated face)
    ratios: { eyeSpanToFace: 0.38, noseWidthToFace: 0.20, mouthWidthToFace: 0.38, jawToFace: 0.78, noseLengthNorm: 0.58, mouthChinNorm: 0.19 },
    // Narrowest eyes, longest nose, most elongated face — triple extreme
    mpRatios: { eyeXSpan: 0.33, nosePositionY: 0.68, earPositionY: 0.24, faceAspectRatio: 0.64 },
  },
  {
    id: 'hatshepsut',
    name: 'Hatshepsut',
    dynasty: '18th Dynasty',
    reign: '1473 – 1458 BCE',
    title: 'Foremost of Noble Women',
    description:
      'One of Egypt\'s most successful female pharaohs, who ruled as king for over 20 years. ' +
      'She was depicted in official art wearing the traditional male pharaoh\'s false beard.',
    traits: ['Strong defined jawline', 'Sharp nose', 'Determined brow', 'Commanding symmetry'],
    emoji: '⚖️',
    accentColor: '#8bc9a8',
    imageUrl: 'assets/pharaohs/hatshepsut.jpg',
    gender: 'female',
    // Signature: widest jaw + narrow mouth (commanding square-jawed face)
    ratios: { eyeSpanToFace: 0.45, noseWidthToFace: 0.23, mouthWidthToFace: 0.30, jawToFace: 0.95, noseLengthNorm: 0.44, mouthChinNorm: 0.32 },
    // Close-set eyes, wide square face, short nose
    mpRatios: { eyeXSpan: 0.36, nosePositionY: 0.57, earPositionY: 0.44, faceAspectRatio: 0.84 },
  },
  {
    id: 'thutmose-iii',
    name: 'Thutmose III',
    dynasty: '18th Dynasty',
    reign: '1479 – 1425 BCE',
    title: 'The Napoleon of Egypt',
    description:
      'The greatest military pharaoh in Egyptian history, who conducted 17 successful ' +
      'military campaigns and expanded Egypt\'s empire to its greatest territorial extent.',
    traits: ['Aquiline prominent nose', 'Compact oval face', 'Determined set jaw', 'Close-set eyes'],
    emoji: '⚔️',
    accentColor: '#c94c4c',
    imageUrl: 'assets/pharaohs/thutmose-iii.jpg',
    gender: 'male',
    // Signature: wide nose + long nose + deepest chin gap (compact warrior face)
    ratios: { eyeSpanToFace: 0.42, noseWidthToFace: 0.27, mouthWidthToFace: 0.31, jawToFace: 0.88, noseLengthNorm: 0.53, mouthChinNorm: 0.34 },
    // Close-set eyes, long aquiline nose, compact elongated face
    mpRatios: { eyeXSpan: 0.35, nosePositionY: 0.66, earPositionY: 0.36, faceAspectRatio: 0.73 },
  },
  {
    id: 'cleopatra-vii',
    name: 'Cleopatra VII',
    dynasty: 'Ptolemaic',
    reign: '51 – 30 BCE',
    title: 'Queen of Kings',
    description:
      'The last active ruler of the Ptolemaic Kingdom of Egypt. A brilliant polyglot and ' +
      'diplomat who allied with both Julius Caesar and Mark Antony to maintain Egyptian power.',
    traits: ['Strong prominent nose', 'Rounded cheeks', 'Wide expressive eyes', 'Regal bearing'],
    emoji: '🐍',
    accentColor: '#9b59b6',
    imageUrl: 'assets/pharaohs/cleopatra-vii.jpg',
    gender: 'female',
    // Signature: wide eyes + wide mouth + moderate nose (diplomatic balanced face)
    ratios: { eyeSpanToFace: 0.49, noseWidthToFace: 0.25, mouthWidthToFace: 0.39, jawToFace: 0.87, noseLengthNorm: 0.43, mouthChinNorm: 0.27 },
    // Wide expressive eyes, balanced oval face, medium nose
    mpRatios: { eyeXSpan: 0.46, nosePositionY: 0.59, earPositionY: 0.45, faceAspectRatio: 0.76 },
  },
  {
    id: 'amenhotep-iii',
    name: 'Amenhotep III',
    dynasty: '18th Dynasty',
    reign: '1388 – 1351 BCE',
    title: 'Amenhotep the Magnificent',
    description:
      'His reign was a golden age of artistic and architectural achievement. Over 250 ' +
      'statues of him are known — more than any other pharaoh. He built the Colossi of Memnon.',
    traits: ['Round cherubic face', 'Wide-set eyes', 'Thick full lips', 'Broad nose'],
    emoji: '🏛️',
    accentColor: '#f0c040',
    imageUrl: 'assets/pharaohs/amenhotep-iii.jpg',
    gender: 'male',
    // Signature: widest mouth + widest eyes + short nose (full rounded face)
    ratios: { eyeSpanToFace: 0.52, noseWidthToFace: 0.22, mouthWidthToFace: 0.44, jawToFace: 0.86, noseLengthNorm: 0.38, mouthChinNorm: 0.31 },
    // Cherubic wide face, wide eyes, medium-short nose, high ears
    mpRatios: { eyeXSpan: 0.44, nosePositionY: 0.57, earPositionY: 0.49, faceAspectRatio: 0.87 },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Euclidean distance between two ratio profiles. Lower = more similar. */
export function facialRatioDistance(
  a: FacialRatioProfile,
  b: FacialRatioProfile,
): number {
  const keys = Object.keys(a) as (keyof FacialRatioProfile)[];
  return Math.sqrt(keys.reduce((acc, k) => acc + (a[k] - b[k]) ** 2, 0));
}

export function mpRatioDistance(
  a: MediaPipeRatioProfile,
  b: MediaPipeRatioProfile,
): number {
  const keys = Object.keys(a) as (keyof MediaPipeRatioProfile)[];
  return Math.sqrt(keys.reduce((acc, k) => acc + (a[k] - b[k]) ** 2, 0));
}

/** Convert a raw distance to a 0–100 similarity score. */
export function distanceToSimilarity(dist: number, maxDist = 0.40): number {
  return Math.round(Math.max(0, Math.min(100, (1 - dist / maxDist) * 100)));
}

/** Derive a confidence label from a similarity score. */
export function scoreToConfidence(score: number): 'Low' | 'Medium' | 'High' {
  if (score >= 70) return 'High';
  if (score >= 45) return 'Medium';
  return 'Low';
}

/** Find the best-matching pharaoh from a facial ratio profile.
 *  Pass gender to restrict candidates to matching-gender pharaohs. */
export function matchFacialRatios(
  userRatios: FacialRatioProfile,
  gender?: 'male' | 'female',
): PharaohMatch {
  const pool = gender ? PHARAOHS.filter(p => p.gender === gender) : PHARAOHS;
  let best = { pharaoh: pool[0], dist: Infinity };
  for (const pharaoh of pool) {
    const dist = facialRatioDistance(userRatios, pharaoh.ratios);
    if (dist < best.dist) best = { pharaoh, dist };
  }
  const similarity = distanceToSimilarity(best.dist);
  return {
    pharaoh:    best.pharaoh,
    similarity,
    confidence: scoreToConfidence(similarity),
  };
}

/** Find the best-matching pharaoh from a MediaPipe ratio profile.
 *  Uses relative scoring so the result is stable regardless of absolute distance scale.
 *  Pass gender to restrict candidates to matching-gender pharaohs. */
export function matchMediaPipeRatios(
  userRatios: MediaPipeRatioProfile,
  gender?: 'male' | 'female',
): PharaohMatch {
  const pool = gender ? PHARAOHS.filter(p => p.gender === gender) : PHARAOHS;
  const scored = pool
    .map(p => ({ pharaoh: p, dist: mpRatioDistance(userRatios, p.mpRatios) }))
    .sort((a, b) => a.dist - b.dist);

  const winner  = scored[0];
  const spread  = (scored[scored.length - 1].dist - winner.dist) || 0.001;
  const clarity = Math.min(1, spread / 0.12);
  const similarity = Math.round(48 + clarity * 42);

  return {
    pharaoh:    winner.pharaoh,
    similarity,
    confidence: scoreToConfidence(similarity),
  };
}
