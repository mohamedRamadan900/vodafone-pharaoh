import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import type { FaceDetection as FaceDetectionType, Results } from '@mediapipe/face_detection';
import * as faceapi from 'face-api.js';
import {
  PHARAOHS, PharaohMatch, MediaPipeRatioProfile,
  matchMediaPipeRatios, mpRatioDistance,
} from '../../models/pharaoh.model';

type AppState =
  | 'loading'
  | 'idle'
  | 'camera-active'
  | 'processing'
  | 'result'
  | 'error';

// The keypoint indices returned by @mediapipe/face_detection
const MP_RIGHT_EYE  = 0;
const MP_LEFT_EYE   = 1;
const MP_NOSE_TIP   = 2;
const MP_MOUTH      = 3;
const MP_RIGHT_EAR  = 4;
const MP_LEFT_EAR   = 5;

@Component({
  selector: 'app-mediapipe-matcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6 animate-slide-up">

      <!-- ── HEADER CARD ───────────────────────────────── -->
      <div class="card flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 class="section-title">Solution C — MediaPipe</h2>
          <p class="text-sand-dim text-sm mt-1">
            Uses Google's <strong class="text-gold">MediaPipe Face Detection</strong> to locate
            six facial landmarks, compute geometric ratios, and match to a pharaoh profile.
          </p>
        </div>
        <span class="text-xs px-3 py-1 rounded-full border border-gold/40 text-gold">
          On-Device
        </span>
      </div>

      <!-- ── LOADING ────────────────────────────────────── -->
      @if (state() === 'loading') {
        <div class="card flex flex-col items-center gap-4 py-12">
          <div class="spinner"></div>
          <p class="text-sand-dim text-sm">Loading MediaPipe Face Detection…</p>
          <p class="text-xs text-sand-dim/60">WASM module is fetched from CDN on first load</p>
        </div>
      }

      <!-- ── ERROR ──────────────────────────────────────── -->
      @if (state() === 'error') {
        <div class="card border-red-900/60 bg-red-950/30 flex items-start gap-3">
          <span class="text-2xl">⚠️</span>
          <div>
            <p class="font-semibold text-red-400">{{ errorMessage() }}</p>
            <button class="btn-outline mt-3 text-xs" (click)="initMediaPipe()">
              Retry
            </button>
          </div>
        </div>
      }

      <!-- ── MAIN PANEL ─────────────────────────────────── -->
      @if (state() !== 'loading' && state() !== 'error') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <!-- LEFT: capture -->
          <div class="card space-y-4">
            <h3 class="font-display text-gold font-semibold tracking-wide">Capture</h3>

            <div class="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video
                #videoEl autoplay playsinline muted
                class="w-full h-full object-cover"
                [class.hidden]="!cameraActive()"
              ></video>

              <!-- Landmark overlay canvas -->
              <canvas
                #overlayEl
                class="overlay w-full h-full"
                [class.hidden]="!showOverlay()"
              ></canvas>

              @if (!cameraActive() && !capturedDataUrl()) {
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sand-dim/50">
                  <span class="text-6xl">📡</span>
                  <p class="text-sm">Start camera or upload a photo</p>
                </div>
              }

              @if (capturedDataUrl() && !cameraActive()) {
                <img [src]="capturedDataUrl()" alt="Captured"
                     class="w-full h-full object-cover"/>
              }

              @if (state() === 'processing') {
                <div class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <div class="spinner"></div>
                  <p class="text-sand-dim text-sm">Running face detection…</p>
                </div>
              }
            </div>

            <!-- Live keypoints info while camera is on -->
            @if (cameraActive() && liveKeypoints()) {
              <p class="text-xs text-emerald-400 flex items-center gap-1.5">
                <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Face detected — 6 keypoints active
              </p>
            }

            <div class="flex flex-wrap gap-3">
              @if (!cameraActive()) {
                <button class="btn-gold" (click)="startCamera()">
                  📷 Start Camera
                </button>
              } @else {
                <button class="btn-gold" (click)="captureFrame()">
                  📸 Capture
                </button>
                <button class="btn-outline" (click)="stopCamera()">
                  ⏹ Stop
                </button>
              }
              <label class="btn-outline cursor-pointer">
                📂 Upload Photo
                <input type="file" accept="image/*" class="hidden"
                       (change)="handleFileUpload($event)"/>
              </label>
            </div>

            @if (capturedDataUrl() && state() !== 'processing') {
              <button class="btn-gold w-full" (click)="detectAndMatch()">
                📡 Detect &amp; Match Pharaoh
              </button>
            }

            @if (noFaceDetected()) {
              <div class="text-amber-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>No face detected. Try better lighting or a clearer frontal photo.</span>
              </div>
            }
          </div>

          <!-- RIGHT: result -->
          <div class="card space-y-4">
            <h3 class="font-display text-gold font-semibold tracking-wide">Your Pharaoh Match</h3>

            @if (!match()) {
              <div class="flex flex-col items-center justify-center h-56 gap-4 text-sand-dim/50">
                <span class="text-5xl">𓌀</span>
                <p class="text-sm text-center">
                  Capture or upload a photo, then click<br>
                  <strong class="text-gold/70">Detect &amp; Match</strong>
                </p>
              </div>
            } @else {
              <div class="animate-slide-up space-y-5">

                <!-- Name banner with photo -->
                <div
                  class="rounded-xl border overflow-hidden"
                  [style.border-color]="match()!.pharaoh.accentColor + '66'"
                >
                  <div class="relative h-52 bg-dark-border overflow-hidden">
                    <img
                      [src]="match()!.pharaoh.imageUrl"
                      [alt]="match()!.pharaoh.name"
                      class="w-full h-full object-cover object-top"
                      (error)="$any($event.target).style.display='none'"
                    />
                    <div class="absolute inset-0 bg-gradient-to-t from-dark-card/90 via-dark-card/20 to-transparent"></div>
                    <div class="absolute bottom-0 left-0 right-0 p-4">
                      <div class="flex items-end gap-3">
                        <span class="text-3xl leading-none">{{ match()!.pharaoh.emoji }}</span>
                        <div>
                          <h4
                            class="font-display text-xl font-bold tracking-wide leading-tight"
                            [style.color]="match()!.pharaoh.accentColor"
                          >
                            {{ match()!.pharaoh.name }}
                          </h4>
                          <p class="text-sand-dim/80 text-xs">{{ match()!.pharaoh.title }}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div
                    class="px-4 py-2 text-xs text-sand-dim/70 flex gap-3"
                    [style.background]="match()!.pharaoh.accentColor + '18'"
                  >
                    <span>{{ match()!.pharaoh.dynasty }}</span>
                    <span class="opacity-40">·</span>
                    <span>{{ match()!.pharaoh.reign }}</span>
                  </div>
                </div>

                <!-- Score ring + gender badge -->
                <div class="flex items-center gap-5">
                  <svg width="80" height="80" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="#3a2e1a" stroke-width="8"/>
                    <circle cx="40" cy="40" r="34" fill="none"
                      [attr.stroke]="match()!.pharaoh.accentColor"
                      stroke-width="8" stroke-linecap="round"
                      stroke-dasharray="213.6"
                      [attr.stroke-dashoffset]="213.6 - (213.6 * match()!.similarity / 100)"
                      transform="rotate(-90 40 40)"
                      style="transition:stroke-dashoffset 0.8s ease"/>
                    <text x="40" y="45" text-anchor="middle" font-size="16" font-weight="bold"
                          font-family="Inter,sans-serif" fill="#f5e6c8">
                      {{ match()!.similarity }}%
                    </text>
                  </svg>
                  <div class="space-y-1.5">
                    <p class="text-sand text-sm font-semibold">Similarity Score</p>
                    <span class="text-xs px-2 py-0.5 rounded-full font-semibold inline-block"
                          [class]="confidenceBadgeClass(match()!.confidence)">
                      {{ match()!.confidence }} Confidence
                    </span>
                    @if (detectedGender()) {
                      <div class="flex items-center gap-1.5 text-xs text-sand-dim/80">
                        <span>{{ detectedGender()!.value === 'male' ? '♂' : '♀' }}</span>
                        <span class="capitalize">{{ detectedGender()!.value }}</span>
                        <span class="text-sand-dim/50">({{ (detectedGender()!.probability * 100) | number:'1.0-0' }}%)</span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Detected ratios table -->
                @if (detectedRatios()) {
                  <div>
                    <p class="text-xs text-sand-dim/70 uppercase tracking-widest mb-2">
                      Detected Facial Geometry
                    </p>
                    <div class="grid grid-cols-4 gap-2">
                      @for (entry of ratioEntries(); track entry.label) {
                        <div class="bg-dark-border/50 rounded-lg p-2 text-center">
                          <p class="text-xs text-sand-dim/60">{{ entry.label }}</p>
                          <p class="text-gold font-semibold text-sm mt-0.5">
                            {{ entry.value | number:'1.2-2' }}
                          </p>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Traits -->
                <div>
                  <p class="text-xs text-sand-dim/70 uppercase tracking-widest mb-2">
                    Pharaoh Traits
                  </p>
                  <div class="flex flex-wrap gap-2">
                    @for (trait of match()!.pharaoh.traits; track trait) {
                      <span class="text-xs px-2.5 py-1 rounded-full bg-dark-border text-sand-dim border border-dark-border">
                        {{ trait }}
                      </span>
                    }
                  </div>
                </div>

                <p class="text-sand-dim text-sm leading-relaxed border-t border-dark-border pt-4">
                  {{ match()!.pharaoh.description }}
                </p>

                <!-- Debug: all pharaoh scores + computed ratios -->
                <details class="border border-dark-border rounded-xl overflow-hidden text-xs">
                  <summary class="px-3 py-2 bg-dark-border/50 cursor-pointer text-sand-dim/70
                                  hover:text-sand-dim select-none">
                    🔬 Show all scores &amp; computed ratios
                  </summary>
                  <div class="p-3 space-y-3">
                    @if (detectedRatios()) {
                      <div>
                        <p class="text-gold/70 mb-1 font-semibold">Your face ratios</p>
                        <div class="grid grid-cols-4 gap-1">
                          @for (e of ratioEntries(); track e.label) {
                            <div class="flex flex-col bg-dark-border/40 rounded px-2 py-1 text-center">
                              <span class="text-sand-dim/60 text-[10px] leading-tight">{{ e.label }}</span>
                              <span class="text-gold font-mono font-semibold mt-0.5">{{ e.value | number:'1.3-3' }}</span>
                            </div>
                          }
                        </div>
                      </div>
                    }
                    <div>
                      <p class="text-gold/70 mb-1 font-semibold">All pharaoh scores</p>
                      <div class="space-y-1">
                        @for (s of allScores(); track s.name) {
                          <div class="flex items-center gap-2">
                            <span class="w-28 text-sand-dim/70 truncate">{{ s.name }}</span>
                            <div class="flex-1 h-1.5 bg-dark-border rounded-full overflow-hidden">
                              <div class="h-full rounded-full transition-all duration-500"
                                   [style.width.%]="s.score"
                                   [style.background]="s.color"></div>
                            </div>
                            <span class="w-8 text-right font-mono"
                                  [class.text-gold]="s.isWinner"
                                  [class.text-sand-dim]="!s.isWinner">
                              {{ s.score }}
                            </span>
                          </div>
                        }
                      </div>
                    </div>
                  </div>
                </details>

                <button class="btn-outline w-full text-sm" (click)="reset()">
                  🔄 Try Another Photo
                </button>
              </div>
            }
          </div>
        </div>
      }

      <!-- ── HOW IT WORKS ────────────────────────────────── -->
      <details class="card cursor-pointer">
        <summary class="font-display text-gold/80 text-sm tracking-wide font-semibold select-none">
          How Solution C Works
        </summary>
        <div class="mt-4 text-sand-dim text-sm space-y-2 leading-relaxed">
          <p>
            1. <strong class="text-sand">Model Init</strong> — MediaPipe Face Detection
            (short-range model) is loaded via CDN; WASM is compiled once and cached.
          </p>
          <p>
            2. <strong class="text-sand">Six Keypoints</strong> — The model returns 6 normalised
            keypoints: right eye, left eye, nose tip, mouth centre, right ear tragion,
            left ear tragion — plus a bounding box.
          </p>
          <p>
            3. <strong class="text-sand">Four Independent Ratios</strong> — Three pure same-axis
            ratios (X with X, Y with Y) eliminate aspect-ratio distortion: <em>eyeXSpan</em>,
            <em>nosePositionY</em>, <em>earPositionY</em>. A fourth ratio, <em>faceAspectRatio</em>,
            is derived from the bounding box pixel dimensions (width ÷ height) and captures
            overall face shape — the strongest single discriminator between round and elongated faces.
          </p>
          <p>
            4. <strong class="text-sand">Relative Profile Matching</strong> — Euclidean distance
            to all eight pharaoh profiles is computed; the winner is selected by rank and scored
            relative to the spread between best and worst match, yielding a stable 48–90% range.
          </p>
        </div>
      </details>
    </div>
  `,
})
export class MediapipeMatcherComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl')   videoRef!:   ElementRef<HTMLVideoElement>;
  @ViewChild('overlayEl') overlayRef!: ElementRef<HTMLCanvasElement>;

  readonly state          = signal<AppState>('loading');
  readonly errorMessage   = signal('');
  readonly cameraActive   = signal(false);
  readonly capturedDataUrl= signal<string | null>(null);
  readonly match          = signal<PharaohMatch | null>(null);
  readonly noFaceDetected = signal(false);
  readonly liveKeypoints  = signal(false);
  readonly showOverlay    = signal(false);
  readonly detectedRatios = signal<MediaPipeRatioProfile | null>(null);
  readonly detectedGender = signal<{ value: 'male' | 'female'; probability: number } | null>(null);

  private detector:         FaceDetectionType | null = null;
  private stream:           MediaStream | null        = null;
  private rafId:            number | null             = null;
  private liveResults:      Results | null            = null;
  private genderModelReady  = false;

  ratioEntries() {
    const r = this.detectedRatios();
    if (!r) return [];
    return [
      { label: 'Eye X-span',    value: r.eyeXSpan },
      { label: 'Nose Y-pos',    value: r.nosePositionY },
      { label: 'Ear Y-pos',     value: r.earPositionY },
      { label: 'Face W/H',      value: r.faceAspectRatio },
    ];
  }

  allScores() {
    const r = this.detectedRatios();
    if (!r) return [];
    const dists = PHARAOHS.map(p => ({
      name:  p.name,
      color: p.accentColor,
      dist:  mpRatioDistance(r, p.mpRatios),
    })).sort((a, b) => a.dist - b.dist);

    const minDist = dists[0].dist;
    const maxDist = dists[dists.length - 1].dist;
    const spread  = (maxDist - minDist) || 0.001;

    return dists.map((s, i) => ({
      name:     s.name,
      color:    s.color,
      score:    Math.round(100 - ((s.dist - minDist) / spread) * 52),
      isWinner: i === 0,
    }));
  }

  // ── Lifecycle ─────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.initMediaPipe();
  }

  ngOnDestroy(): void {
    this.stopCamera();
    this.detector?.close();
  }

  // ── MediaPipe init ─────────────────────────────────────────
  async initMediaPipe(): Promise<void> {
    this.state.set('loading');
    this.errorMessage.set('');
    try {
      // Dynamic import so the module is only loaded for this tab
      const { FaceDetection } = await import('@mediapipe/face_detection') as {
        FaceDetection: new (config: { locateFile: (f: string) => string }) => FaceDetectionType;
      };

      this.detector = new FaceDetection({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/${file}`,
      });

      (this.detector as FaceDetectionType & {
        setOptions(opts: Record<string, unknown>): void;
      }).setOptions({
        model:                 'short',
        minDetectionConfidence: 0.5,
      });

      this.detector.onResults((results: Results) => {
        this.liveResults = results;
        this.liveKeypoints.set((results.detections ?? []).length > 0);
        if (this.cameraActive()) this.drawOverlay(results);
      });

      await this.detector.initialize();
      this.state.set('idle');
    } catch (err) {
      this.errorMessage.set(
        'MediaPipe failed to load. Check your internet connection. ' +
        (err instanceof Error ? err.message : String(err)),
      );
      this.state.set('error');
    }
  }

  // ── Camera ─────────────────────────────────────────────────
  async startCamera(): Promise<void> {
    if (!this.detector) return;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      await new Promise(r => setTimeout(r, 50));
      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.cameraActive.set(true);
      this.showOverlay.set(true);
      this.capturedDataUrl.set(null);
      this.match.set(null);
      this.noFaceDetected.set(false);
      this.state.set('camera-active');
      this.startLiveDetection();
    } catch (err) {
      this.errorMessage.set('Camera denied. ' + (err instanceof Error ? err.message : ''));
      this.state.set('error');
    }
  }

  stopCamera(): void {
    if (this.rafId !== null) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.cameraActive.set(false);
    this.showOverlay.set(false);
    this.liveKeypoints.set(false);
    if (this.state() === 'camera-active') this.state.set('idle');
  }

  private startLiveDetection(): void {
    const video    = this.videoRef.nativeElement;
    const detector = this.detector!;
    const tick = async () => {
      if (!this.cameraActive()) return;
      if (video.readyState >= 2) {
        await detector.send({ image: video });
      }
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  captureFrame(): void {
    const video  = this.videoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d')!;
    // Un-mirror for consistent ratio computation (mirror applied via CSS only)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);
    this.capturedDataUrl.set(canvas.toDataURL('image/jpeg', 0.9));
    this.stopCamera();
    this.match.set(null);
    this.noFaceDetected.set(false);
    this.state.set('idle');
  }

  handleFileUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.capturedDataUrl.set(reader.result as string);
      this.match.set(null);
      if (this.cameraActive()) this.stopCamera();
      this.state.set('idle');
    };
    reader.readAsDataURL(file);
  }

  // ── Gender model (lazy, shared with Solution A if already loaded) ─────────
  private async ensureGenderModel(): Promise<void> {
    if (this.genderModelReady) return;
    const MODEL_URL = '/assets/models';
    if (!faceapi.nets.ssdMobilenetv1.isLoaded) {
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);
    }
    if (!faceapi.nets.ageGenderNet.isLoaded) {
      await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
    }
    this.genderModelReady = true;
  }

  // ── Detection ─────────────────────────────────────────────
  async detectAndMatch(): Promise<void> {
    const dataUrl = this.capturedDataUrl();
    if (!dataUrl || !this.detector) return;

    this.state.set('processing');
    this.noFaceDetected.set(false);
    this.match.set(null);
    this.detectedRatios.set(null);
    this.detectedGender.set(null);

    try {
      const img = await this.loadImage(dataUrl);

      // Temporarily override onResults to capture the static detection result,
      // then restore the live camera callback so startLiveDetection() still works.
      let results: Results | null = null;
      this.detector.onResults((r: Results) => { results = r; });
      await this.detector.send({ image: img });

      // Restore live camera callback
      this.detector.onResults((results: Results) => {
        this.liveResults = results;
        this.liveKeypoints.set((results.detections ?? []).length > 0);
        if (this.cameraActive()) this.drawOverlay(results);
      });

      if (!results || !(results as Results).detections?.length) {
        this.noFaceDetected.set(true);
        this.state.set('idle');
        return;
      }

      const detection = (results as Results).detections[0];
      const kps = detection.landmarks;
      if (!kps || kps.length < 6) {
        this.noFaceDetected.set(true);
        this.state.set('idle');
        return;
      }

      // Compute face aspect ratio from bounding box + actual pixel dimensions.
      // bb.width/height are normalized to [0,1] relative to the image dimensions,
      // so multiplying by the pixel size gives the true pixel w/h ratio.
      const bb = detection.boundingBox;
      const faceAspectRatio = (bb && img.naturalWidth && img.naturalHeight)
        ? (bb.width * img.naturalWidth) / (bb.height * img.naturalHeight)
        : 0.80; // fallback to population average

      const ratios: MediaPipeRatioProfile = {
        ...this.computeKeypointRatios(kps),
        faceAspectRatio,
      };
      this.detectedRatios.set(ratios);

      // Detect gender via face-api.js (loads models once, reuses if Solution A ran first)
      let gender: 'male' | 'female' | undefined;
      try {
        await this.ensureGenderModel();
        const gd = await faceapi
          .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
          .withAgeAndGender();
        if (gd) {
          gender = gd.gender as 'male' | 'female';
          this.detectedGender.set({ value: gender, probability: gd.genderProbability });
        }
      } catch {
        // Gender detection is best-effort; proceed without it if it fails
      }

      const result = matchMediaPipeRatios(ratios, gender);
      this.match.set(result);
      this.state.set('result');
    } catch (err) {
      this.errorMessage.set(
        'Detection failed. ' + (err instanceof Error ? err.message : String(err)),
      );
      this.state.set('error');
    }
  }

  // ── Keypoint ratio computation ────────────────────────────
  // Pure same-axis ratios (X with X, Y with Y) to avoid aspect-ratio distortion.
  // faceAspectRatio is computed separately from the bounding box in detectAndMatch().
  private computeKeypointRatios(
    kps: Array<{ x: number; y: number }>,
  ): { eyeXSpan: number; nosePositionY: number; earPositionY: number } {
    const rightEye = kps[MP_RIGHT_EYE];
    const leftEye  = kps[MP_LEFT_EYE];
    const noseTip  = kps[MP_NOSE_TIP];
    const mouth    = kps[MP_MOUTH];
    const rightEar = kps[MP_RIGHT_EAR];
    const leftEar  = kps[MP_LEFT_EAR];

    const eyeMidY       = (leftEye.y + rightEye.y) / 2;
    const earMidY       = (leftEar.y + rightEar.y) / 2;
    const eyeMouthSpanY = (mouth.y - eyeMidY) || 0.001;

    // X-only: how wide the eyes are relative to face width (ear-to-ear X span)
    const eyeXSpan      = Math.abs(leftEye.x - rightEye.x) /
                          (Math.abs(leftEar.x - rightEar.x) || 0.001);

    // Y-only: where the nose tip sits in the eye→mouth vertical span
    const nosePositionY = (noseTip.y - eyeMidY) / eyeMouthSpanY;

    // Y-only: where the ear tragion sits in the eye→mouth vertical span
    const earPositionY  = (earMidY  - eyeMidY) / eyeMouthSpanY;

    return { eyeXSpan, nosePositionY, earPositionY };
  }

  // ── Live overlay drawing ──────────────────────────────────
  private drawOverlay(results: Results): void {
    const canvas  = this.overlayRef?.nativeElement;
    const video   = this.videoRef?.nativeElement;
    if (!canvas || !video) return;

    canvas.width  = video.clientWidth;
    canvas.height = video.clientHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const detection of results.detections ?? []) {
      const bb = detection.boundingBox;
      if (bb) {
        const x = bb.xCenter   * canvas.width  - (bb.width  * canvas.width)  / 2;
        const y = bb.yCenter   * canvas.height - (bb.height * canvas.height) / 2;
        const w = bb.width     * canvas.width;
        const h = bb.height    * canvas.height;
        ctx.strokeStyle = '#c9a84c';
        ctx.lineWidth   = 2;
        ctx.strokeRect(x, y, w, h);
      }

      // Draw keypoints
      for (const kp of detection.landmarks ?? []) {
        ctx.beginPath();
        ctx.arc(kp.x * canvas.width, kp.y * canvas.height, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e8c96a';
        ctx.fill();
      }
    }
  }

  // ── Helpers ───────────────────────────────────────────────
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload  = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  reset(): void {
    this.capturedDataUrl.set(null);
    this.match.set(null);
    this.noFaceDetected.set(false);
    this.detectedRatios.set(null);
    this.detectedGender.set(null);
    this.state.set('idle');
  }

  confidenceBadgeClass(conf: 'Low' | 'Medium' | 'High'): string {
    return {
      High:   'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
      Medium: 'bg-amber-900/60  text-amber-300  border border-amber-700',
      Low:    'bg-red-900/60    text-red-300    border border-red-700',
    }[conf];
  }
}
