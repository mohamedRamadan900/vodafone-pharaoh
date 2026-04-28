# Pharaoh Matcher 𓂀

Match your face to an Egyptian pharaoh using three different AI approaches.

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Download face-api.js model weights (required for Tab 1)
npm run download-models

# 3. Add your Anthropic API key (required for Tab 2)
#    Edit src/environments/environment.ts → ANTHROPIC_API_KEY

# 4. Start the dev server
npm start
```

Open `http://localhost:4200`

---

## Three Solutions

| Tab | Library | Runs Where | API Key Needed |
|-----|---------|-----------|----------------|
| Solution A | face-api.js + TensorFlow.js | Browser (on-device) | No |
| Solution B | @anthropic-ai/sdk (Claude Vision) | Cloud (Anthropic API) | **Yes** |
| Solution C | @mediapipe/face_detection | Browser (on-device) | No |

---

## Face-API.js Models (Tab 1)

Tab 1 requires three TensorFlow model weight files in `src/assets/models/`.
Run the download script:

```bash
npm run download-models
```

This fetches:
- `ssd_mobilenetv1_model-weights_manifest.json` + shard files
- `face_landmark_68_model-weights_manifest.json` + shard files
- `face_recognition_model-weights_manifest.json` + shard files

Models are ~6.5 MB total and are sourced from the official face-api.js GitHub repository.

---

## Anthropic API Key (Tab 2)

1. Get a key from https://console.anthropic.com
2. Open `src/environments/environment.ts`
3. Replace `YOUR_ANTHROPIC_API_KEY_HERE` with your key
4. Alternatively, paste the key directly into the UI field (session-only, not persisted)

> **Security note:** The key is sent from the browser. Never deploy to production this way —
> use a server-side proxy instead.

---

## How Each Solution Matches Pharaohs

### Solution A (face-api.js)
1. Loads SSD MobileNet + Face Landmark 68 Net + Face Recognition Net from `/assets/models/`
2. Detects 68 facial landmarks
3. Computes 6 geometric ratios (eye span, nose width, mouth width, jaw width, nose length, chin distance)
4. Matches ratio vector against 8 pharaoh profiles using Euclidean distance

### Solution B (Claude Vision)
1. Encodes the captured image as base64
2. Sends it to `claude-opus-4-5` with a structured prompt
3. Claude analyses facial features and returns a JSON match result
4. The app enriches the result with local pharaoh biography data

### Solution C (MediaPipe)
1. Loads MediaPipe Face Detection (short model) via CDN WASM
2. Returns 6 normalised keypoints (eyes, nose tip, mouth, ears)
3. Computes 3 geometric ratios
4. Matches against pharaoh profiles using Euclidean distance

---

## Pharaohs in the Dataset

| Pharaoh | Dynasty | Reign |
|---------|---------|-------|
| Ramesses II | 19th Dynasty | 1279–1213 BCE |
| Tutankhamun | 18th Dynasty | 1332–1323 BCE |
| Nefertiti | 18th Dynasty | c. 1353–1336 BCE |
| Akhenaten | 18th Dynasty | 1353–1336 BCE |
| Hatshepsut | 18th Dynasty | 1473–1458 BCE |
| Thutmose III | 18th Dynasty | 1479–1425 BCE |
| Cleopatra VII | Ptolemaic | 51–30 BCE |
| Amenhotep III | 18th Dynasty | 1388–1351 BCE |

---

## Project Structure

```
src/
├── app/
│   ├── app.component.ts              # Shell with tabs
│   ├── app.config.ts
│   ├── app.routes.ts
│   ├── models/
│   │   └── pharaoh.model.ts          # Shared data + matching algorithms
│   └── components/
│       ├── face-api-matcher/         # Tab 1 — face-api.js
│       ├── claude-vision-matcher/    # Tab 2 — Anthropic SDK
│       └── mediapipe-matcher/        # Tab 3 — MediaPipe
├── assets/
│   └── models/                       # face-api.js weight files (downloaded)
└── environments/
    └── environment.ts                # ANTHROPIC_API_KEY goes here
```

---

## Tech Stack

- **Angular 17** (standalone components, signals, new control flow)
- **TailwindCSS 3** (custom Egyptian gold theme)
- **face-api.js 0.22** (Tab 1)
- **@anthropic-ai/sdk** (Tab 2)
- **@mediapipe/face_detection** (Tab 3)


      // Draw styled keypoints on the captured/uploaded image overlay

