import {
  Component, OnInit, OnDestroy,
  ViewChild, ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import * as faceapi from 'face-api.js';
import {
  PHARAOHS, PharaohMatch, FacialRatioProfile,
  matchFacialRatios, facialRatioDistance, distanceToSimilarity,
} from '../../models/pharaoh.model';

type AppState =
  | 'loading-models'
  | 'idle'
  | 'camera-active'
  | 'processing'
  | 'result'
  | 'error';

@Component({
  selector: 'app-face-api-matcher',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6 animate-slide-up">

      <!-- ── STEP INDICATOR ─────────────────────────────── -->
      <div class="card flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 class="section-title">Solution A — Local AI</h2>
          <p class="text-sand-dim text-sm mt-1">
            Powered by <strong class="text-gold">face-api.js</strong> + TensorFlow.js &mdash;
            runs entirely in your browser. No data leaves your device.
          </p>
        </div>
        <span class="text-xs px-3 py-1 rounded-full border border-gold/40 text-gold">
          On-Device
        </span>
      </div>

      <!-- ── MODEL LOADING ──────────────────────────────── -->
      @if (state() === 'loading-models') {
        <div class="card flex flex-col items-center gap-4 py-12">
          <div class="spinner"></div>
          <p class="text-sand-dim text-sm">{{ loadingMessage() }}</p>
          <div class="w-64 h-1.5 bg-dark-border rounded-full overflow-hidden">
            <div
              class="h-full bg-gold rounded-full transition-all duration-500"
              [style.width.%]="loadingPct()"
            ></div>
          </div>
          <p class="text-xs text-sand-dim/60">
            Models are loaded once and cached by the browser.
          </p>
        </div>
      }

      <!-- ── ERROR STATE ────────────────────────────────── -->
      @if (state() === 'error') {
        <div class="card border-red-900/60 bg-red-950/30 flex items-start gap-3">
          <span class="text-2xl mt-0.5">⚠️</span>
          <div>
            <p class="font-semibold text-red-400">{{ errorMessage() }}</p>
            <p class="text-sand-dim text-sm mt-1">
              Make sure the face-api.js model files are placed in
              <code class="text-gold">/src/assets/models/</code>.
              See the README for the download script.
            </p>
            <button class="btn-outline mt-3 text-xs" (click)="retryLoadModels()">
              Retry
            </button>
          </div>
        </div>
      }

      <!-- ── MAIN PANEL (idle / camera-active / processing / result) ── -->
      @if (state() !== 'loading-models' && state() !== 'error') {
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

          <!-- LEFT: camera / upload / preview -->
          <div class="card space-y-4">
            <h3 class="font-display text-gold font-semibold tracking-wide">Capture</h3>

            <!-- Video -->
            <div class="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
              <video
                #videoEl
                autoplay
                playsinline
                muted
                class="w-full h-full object-cover"
                [class.hidden]="!cameraActive()"
              ></video>
              <canvas #overlayEl class="overlay w-full h-full object-cover"></canvas>

              <!-- Idle placeholder -->
              @if (!cameraActive() && !capturedDataUrl()) {
                <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sand-dim">
                  <span class="text-6xl opacity-30">𓂀</span>
                  <p class="text-sm">Start camera or upload a photo</p>
                </div>
              }

              <!-- Captured image preview -->
              @if (capturedDataUrl() && !cameraActive()) {
                <img
                  [src]="capturedDataUrl()"
                  alt="Captured face"
                  class="w-full h-full object-cover"
                />
              }

              <!-- Processing overlay -->
              @if (state() === 'processing') {
                <div class="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3">
                  <div class="spinner"></div>
                  <p class="text-sand-dim text-sm">Detecting face…</p>
                </div>
              }
            </div>

            <!-- Controls -->
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

              <!-- File upload -->
              <label class="btn-outline cursor-pointer">
                📂 Upload Photo
                <input
                  type="file"
                  accept="image/*"
                  class="hidden"
                  (change)="handleFileUpload($event)"
                />
              </label>
            </div>

            <!-- Detect button -->
            @if (capturedDataUrl() && state() !== 'processing') {
              <button
                class="btn-gold w-full"
                (click)="detectAndMatch()"
                [disabled]="state() === 'processing'"
              >
                🔍 Detect &amp; Match Pharaoh
              </button>
            }

            <!-- No-face warning -->
            @if (noFaceDetected()) {
              <div class="text-amber-400 text-sm flex items-center gap-2">
                <span>⚠️</span>
                <span>No face detected. Try better lighting or a clearer photo.</span>
              </div>
            }
          </div>

          <!-- RIGHT: result -->
          <div class="card space-y-4">
            <h3 class="font-display text-gold font-semibold tracking-wide">Your Pharaoh Match</h3>

            @if (!match()) {
              <div class="flex flex-col items-center justify-center h-56 gap-4 text-sand-dim/50">
                <span class="text-5xl">𓋴</span>
                <p class="text-sm text-center">
                  Capture or upload a photo, then click<br>
                  <strong class="text-gold/70">Detect &amp; Match</strong>
                </p>
              </div>
            } @else {
              <div class="animate-slide-up space-y-5">
                <!-- Pharaoh name banner with photo -->
                <div
                  class="rounded-xl border overflow-hidden"
                  [style.border-color]="match()!.pharaoh.accentColor + '66'"
                >
                  <!-- Photo strip -->
                  <div class="relative h-52 bg-dark-border overflow-hidden">
                    <img
                      [src]="match()!.pharaoh.imageUrl"
                      [alt]="match()!.pharaoh.name"
                      class="w-full h-full object-cover object-top"
                      (error)="$any($event.target).style.display='none'"
                    />
                    <!-- gradient overlay so text is always readable -->
                    <div class="absolute inset-0 bg-gradient-to-t from-dark-card/90 via-dark-card/20 to-transparent"></div>
                    <!-- Name overlaid on the photo -->
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
                  <!-- Dynasty/reign strip -->
                  <div
                    class="px-4 py-2 text-xs text-sand-dim/70 flex gap-3"
                    [style.background]="match()!.pharaoh.accentColor + '18'"
                  >
                    <span>{{ match()!.pharaoh.dynasty }}</span>
                    <span class="opacity-40">·</span>
                    <span>{{ match()!.pharaoh.reign }}</span>
                  </div>
                </div>

                <!-- Score ring -->
                <div class="flex items-center gap-5">
                  <div class="relative shrink-0">
                    <!-- SVG ring -->
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle cx="40" cy="40" r="34" fill="none" stroke="#3a2e1a" stroke-width="8"/>
                      <circle
                        cx="40" cy="40" r="34" fill="none"
                        [attr.stroke]="match()!.pharaoh.accentColor"
                        stroke-width="8"
                        stroke-linecap="round"
                        stroke-dasharray="213.6"
                        [attr.stroke-dashoffset]="213.6 - (213.6 * match()!.similarity / 100)"
                        transform="rotate(-90 40 40)"
                        style="transition: stroke-dashoffset 0.8s ease"
                      />
                      <text x="40" y="45" text-anchor="middle" font-size="16" font-weight="bold"
                            font-family="Inter,sans-serif" fill="#f5e6c8">
                        {{ match()!.similarity }}%
                      </text>
                    </svg>
                  </div>
                  <div>
                    <p class="text-sand text-sm font-semibold">Similarity Score</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span
                        class="text-xs px-2 py-0.5 rounded-full font-semibold"
                        [class]="confidenceBadgeClass(match()!.confidence)"
                      >
                        {{ match()!.confidence }} Confidence
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Traits -->
                <div>
                  <p class="text-xs text-sand-dim/70 uppercase tracking-widest mb-2">Matching Traits</p>
                  <div class="flex flex-wrap gap-2">
                    @for (trait of match()!.pharaoh.traits; track trait) {
                      <span class="text-xs px-2.5 py-1 rounded-full bg-dark-border text-sand-dim border border-dark-border">
                        {{ trait }}
                      </span>
                    }
                  </div>
                </div>

                <!-- Description -->
                <p class="text-sand-dim text-sm leading-relaxed border-t border-dark-border pt-4">
                  {{ match()!.pharaoh.description }}
                </p>

                <!-- Debug: all pharaoh scores -->
                <details class="border border-dark-border rounded-xl overflow-hidden text-xs">
                  <summary class="px-3 py-2 bg-dark-border/50 cursor-pointer text-sand-dim/70
                                  hover:text-sand-dim select-none">
                    🔬 Show all scores &amp; computed ratios
                  </summary>
                  <div class="p-3 space-y-3">
                    <!-- Computed face ratios -->
                    @if (detectedRatios()) {
                      <div>
                        <p class="text-gold/70 mb-1 font-semibold">Your face ratios</p>
                        <div class="grid grid-cols-2 gap-1">
                          @for (e of ratioEntries(); track e.key) {
                            <div class="flex justify-between bg-dark-border/40 rounded px-2 py-1">
                              <span class="text-sand-dim/60">{{ e.label }}</span>
                              <span class="text-sand font-mono">{{ e.value | number:'1.3-3' }}</span>
                            </div>
                          }
                        </div>
                      </div>
                    }
                    <!-- All pharaoh distances -->
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

                <!-- Try again -->
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
          How Solution A Works
        </summary>
        <div class="mt-4 text-sand-dim text-sm space-y-2 leading-relaxed">
          <p>
            1. <strong class="text-sand">Model Loading</strong> — Three TensorFlow.js models are
            loaded from <code class="text-gold">/assets/models/</code>:
            SSD MobileNet (face detection), Face Landmark 68 Net, and Face Recognition Net.
          </p>
          <p>
            2. <strong class="text-sand">Landmark Extraction</strong> — face-api.js locates
            68 precise facial landmarks (jaw, eyebrows, nose, eyes, lips).
          </p>
          <p>
            3. <strong class="text-sand">Ratio Computation</strong> — Six geometric ratios are
            computed from the landmarks (eye span, nose width, mouth width, jaw width,
            nose length, and chin-mouth distance — all relative to face dimensions).
          </p>
          <p>
            4. <strong class="text-sand">Profile Matching</strong> — The ratio vector is compared
            to eight pharaoh profiles derived from archaeological evidence using
            Euclidean distance. The closest profile wins.
          </p>
        </div>
      </details>
    </div>
  `,
})
export class FaceApiMatcherComponent implements OnInit, OnDestroy {
  @ViewChild('videoEl')   videoRef!:   ElementRef<HTMLVideoElement>;
  @ViewChild('overlayEl') overlayRef!: ElementRef<HTMLCanvasElement>;

  readonly state           = signal<AppState>('loading-models');
  readonly loadingMessage  = signal('Initializing TensorFlow.js…');
  readonly loadingPct      = signal(0);
  readonly errorMessage    = signal('');
  readonly cameraActive    = signal(false);
  readonly capturedDataUrl = signal<string | null>(null);
  readonly match           = signal<PharaohMatch | null>(null);
  readonly noFaceDetected  = signal(false);
  readonly detectedRatios  = signal<FacialRatioProfile | null>(null);

  private stream: MediaStream | null = null;

  // ── Debug helpers ─────────────────────────────────────────
  ratioEntries() {
    const r = this.detectedRatios();
    if (!r) return [];
    return [
      { key: 'eyeSpan',    label: 'Eye span / face',     value: r.eyeSpanToFace },
      { key: 'noseW',      label: 'Nose width / face',   value: r.noseWidthToFace },
      { key: 'mouthW',     label: 'Mouth width / face',  value: r.mouthWidthToFace },
      { key: 'jawRatio',   label: 'Jaw ratio',           value: r.jawToFace },
      { key: 'noseLen',    label: 'Nose length norm',    value: r.noseLengthNorm },
      { key: 'mouthChin',  label: 'Mouth→chin norm',     value: r.mouthChinNorm },
    ];
  }

  allScores() {
    const r = this.detectedRatios();
    if (!r) return [];
    const scores = PHARAOHS.map(p => ({
      name:     p.name,
      color:    p.accentColor,
      score:    distanceToSimilarity(facialRatioDistance(r, p.ratios)),
      isWinner: false,
    })).sort((a, b) => b.score - a.score);
    if (scores.length) scores[0].isWinner = true;
    return scores;
  }

  // ── Lifecycle ────────────────────────────────────────────
  async ngOnInit(): Promise<void> {
    await this.loadModels();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  // ── Model loading ─────────────────────────────────────────
  async loadModels(): Promise<void> {
    this.state.set('loading-models');
    this.loadingPct.set(0);
    this.errorMessage.set('');

    const MODEL_URL = '/assets/models';
    try {
      this.loadingMessage.set('Loading SSD MobileNet (face detection)…');
      this.loadingPct.set(5);
      await faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL);

      this.loadingMessage.set('Loading Face Landmark 68 Net…');
      this.loadingPct.set(45);
      await faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL);

      this.loadingMessage.set('Loading Face Recognition Net…');
      this.loadingPct.set(75);
      await faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);

      this.loadingPct.set(100);
      this.state.set('idle');
    } catch (err) {
      this.errorMessage.set(
        'Failed to load face-api.js models. ' +
        (err instanceof Error ? err.message : String(err)),
      );
      this.state.set('error');
    }
  }

  async retryLoadModels(): Promise<void> {
    await this.loadModels();
  }

  // ── Camera ────────────────────────────────────────────────
  async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      // Give Angular time to render the video element
      await new Promise(r => setTimeout(r, 50));
      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.cameraActive.set(true);
      this.capturedDataUrl.set(null);
      this.match.set(null);
      this.noFaceDetected.set(false);
      this.state.set('camera-active');
    } catch (err) {
      this.errorMessage.set(
        'Camera access denied. ' + (err instanceof Error ? err.message : ''),
      );
      this.state.set('error');
    }
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.cameraActive.set(false);
    if (this.state() === 'camera-active') this.state.set('idle');
  }

  captureFrame(): void {
    const video  = this.videoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    this.capturedDataUrl.set(canvas.toDataURL('image/jpeg', 0.9));
    this.stopCamera();
    this.match.set(null);
    this.noFaceDetected.set(false);
    this.state.set('idle');
  }

  // ── File upload ───────────────────────────────────────────
  handleFileUpload(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      this.capturedDataUrl.set(reader.result as string);
      this.match.set(null);
      this.noFaceDetected.set(false);
      if (this.cameraActive()) this.stopCamera();
      this.state.set('idle');
    };
    reader.readAsDataURL(file);
  }

  // ── Detection & matching ──────────────────────────────────
  async detectAndMatch(): Promise<void> {
    const dataUrl = this.capturedDataUrl();
    if (!dataUrl) return;

    this.state.set('processing');
    this.noFaceDetected.set(false);
    this.match.set(null);
    this.detectedRatios.set(null);

    try {
      const img = await faceapi.fetchImage(dataUrl);
      const detection = await faceapi
        .detectSingleFace(img, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.4 }))
        .withFaceLandmarks();

      if (!detection) {
        this.noFaceDetected.set(true);
        this.state.set('idle');
        return;
      }

      const ratios = this.computeRatios(detection.landmarks);
      this.detectedRatios.set(ratios);
      const result = matchFacialRatios(ratios);
      this.match.set(result);
      this.state.set('result');
    } catch (err) {
      this.errorMessage.set(
        'Detection failed. ' + (err instanceof Error ? err.message : String(err)),
      );
      this.state.set('error');
    }
  }

  // ── Landmark → ratio computation ──────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private computeRatios(landmarks: any): FacialRatioProfile {
    const pts: Array<{ x: number; y: number }> = landmarks.positions;
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    // Face width: outer jaw corners (pts 0..16)
    const faceWidth      = dist(pts[0], pts[16]);
    // Inner jaw at cheekbones
    const jawWidth       = dist(pts[3], pts[13]);
    // Inter-ocular distance: outer eye corners
    const eyeSpan        = dist(pts[36], pts[45]);
    // Nose width: nostril points
    const noseWidth      = dist(pts[31], pts[35]);
    // Mouth width: corner lip points
    const mouthWidth     = dist(pts[48], pts[54]);

    // Vertical: use Y-axis (image coords, y increases downward)
    const noseBridgeY    = pts[27].y;
    const noseTipY       = pts[33].y;
    const chinY          = pts[8].y;
    const mouthCenterY   = ((pts[51].y + pts[57].y) / 2);

    // Lower-face height: nose bridge → chin
    const lowerFaceH     = Math.abs(chinY - noseBridgeY) || 1;
    const noseLength     = Math.abs(noseTipY - noseBridgeY);
    const mouthToChin    = Math.abs(chinY - mouthCenterY);

    return {
      eyeSpanToFace:    eyeSpan    / (faceWidth || 1),
      noseWidthToFace:  noseWidth  / (faceWidth || 1),
      mouthWidthToFace: mouthWidth / (faceWidth || 1),
      jawToFace:        jawWidth   / (faceWidth || 1),
      noseLengthNorm:   noseLength / lowerFaceH,
      mouthChinNorm:    mouthToChin / lowerFaceH,
    };
  }

  // ── Reset ─────────────────────────────────────────────────
  reset(): void {
    this.capturedDataUrl.set(null);
    this.match.set(null);
    this.detectedRatios.set(null);
    this.noFaceDetected.set(false);
    this.state.set('idle');
  }

  // ── UI helpers ────────────────────────────────────────────
  confidenceBadgeClass(conf: 'Low' | 'Medium' | 'High'): string {
    return {
      High:   'bg-emerald-900/60 text-emerald-300 border border-emerald-700',
      Medium: 'bg-amber-900/60  text-amber-300  border border-amber-700',
      Low:    'bg-red-900/60    text-red-300    border border-red-700',
    }[conf];
  }
}
