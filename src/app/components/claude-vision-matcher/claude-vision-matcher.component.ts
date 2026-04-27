import {
  Component, OnDestroy,
  ViewChild, ElementRef,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Anthropic from '@anthropic-ai/sdk';
import { environment } from '../../../environments/environment';
import {
  PHARAOHS, PharaohMatch,
  scoreToConfidence,
} from '../../models/pharaoh.model';

type AppState = 'idle' | 'camera-active' | 'analyzing' | 'result' | 'error';

interface ClaudeResponsePayload {
  pharaoh:     string;
  similarity:  number;
  mainFeatures: string[];
  explanation: string;
}

@Component({
  selector: 'app-claude-vision-matcher',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6 animate-slide-up">

      <!-- ── HEADER CARD ───────────────────────────────── -->
      <div class="card flex flex-wrap gap-4 items-center justify-between">
        <div>
          <h2 class="section-title">Solution B — Claude Vision</h2>
          <p class="text-sand-dim text-sm mt-1">
            Uses <strong class="text-gold">Anthropic Claude</strong> multimodal vision to
            analyse your facial features and determine which pharaoh you resemble most.
          </p>
        </div>
        <span class="text-xs px-3 py-1 rounded-full border border-gold/40 text-gold">
          Cloud AI
        </span>
      </div>

      <!-- ── API KEY BANNER ────────────────────────────── -->
      @if (apiKeyMissing()) {
        <div class="card border-amber-800/60 bg-amber-950/30 flex items-start gap-3">
          <span class="text-2xl shrink-0">🔑</span>
          <div class="flex-1">
            <p class="font-semibold text-amber-300">API Key Required</p>
            <p class="text-sand-dim text-sm mt-1">
              Set your Anthropic API key in
              <code class="text-gold">src/environments/environment.ts</code>
              (the <code class="text-gold">ANTHROPIC_API_KEY</code> field),
              then rebuild the project.
            </p>
            <p class="text-xs text-sand-dim/60 mt-2">
              You can also paste a key here for this session only (not persisted):
            </p>
            <div class="flex gap-2 mt-2">
              <input
                type="password"
                [(ngModel)]="sessionApiKey"
                placeholder="sk-ant-api03-…"
                class="flex-1 bg-dark-border border border-dark-border rounded-lg
                       px-3 py-2 text-sm text-sand focus:outline-none focus:border-gold/60"
              />
              <button class="btn-gold text-xs" (click)="applySessionKey()">
                Apply
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ── MAIN PANEL ─────────────────────────────────── -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">

        <!-- LEFT: capture -->
        <div class="card space-y-4">
          <h3 class="font-display text-gold font-semibold tracking-wide">Capture</h3>

          <!-- Video / preview area -->
          <div class="relative rounded-xl overflow-hidden bg-black aspect-[4/3]">
            <video
              #videoEl
              autoplay
              playsinline
              muted
              class="w-full h-full object-cover"
              [class.hidden]="!cameraActive()"
            ></video>

            @if (!cameraActive() && !capturedDataUrl()) {
              <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sand-dim/50">
                <span class="text-6xl">👁️</span>
                <p class="text-sm">Start camera or upload a photo</p>
              </div>
            }

            @if (capturedDataUrl() && !cameraActive()) {
              <img [src]="capturedDataUrl()" alt="Captured face"
                   class="w-full h-full object-cover"/>
            }

            <!-- Analysing overlay -->
            @if (state() === 'analyzing') {
              <div class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-4">
                <div class="relative">
                  <div class="w-16 h-16 rounded-full border-4 border-dark-border border-t-gold animate-spin"></div>
                  <span class="absolute inset-0 flex items-center justify-center text-2xl">👁️</span>
                </div>
                <p class="text-sand-dim text-sm text-center px-4">
                  Claude is reading your face…<br>
                  <span class="text-xs opacity-60">This may take a few seconds</span>
                </p>
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
            <label class="btn-outline cursor-pointer">
              📂 Upload Photo
              <input type="file" accept="image/*" class="hidden" (change)="handleFileUpload($event)"/>
            </label>
          </div>

          @if (capturedDataUrl() && state() !== 'analyzing') {
            <button
              class="btn-gold w-full"
              [disabled]="state() === 'analyzing' || apiKeyMissing()"
              (click)="analyzeWithClaude()"
            >
              🔮 Ask Claude
            </button>
          }
        </div>

        <!-- RIGHT: result -->
        <div class="card space-y-4">
          <h3 class="font-display text-gold font-semibold tracking-wide">Claude's Verdict</h3>

          @if (!match() && state() !== 'analyzing') {
            <div class="flex flex-col items-center justify-center h-56 gap-4 text-sand-dim/50">
              <span class="text-5xl">𓆣</span>
              <p class="text-sm text-center">
                Capture or upload a photo, then click<br>
                <strong class="text-gold/70">Ask Claude</strong>
              </p>
            </div>
          }

          @if (state() === 'analyzing') {
            <div class="space-y-3">
              @for (_ of skeletonLines; track $index) {
                <div class="shimmer h-4 rounded-full"
                     [style.width]="skeletonWidths[$index]"></div>
              }
            </div>
          }

          @if (match()) {
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

              <!-- Score ring -->
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
                <div>
                  <p class="text-sand text-sm font-semibold">Similarity Score</p>
                  <span class="text-xs px-2 py-0.5 rounded-full font-semibold mt-1 inline-block"
                        [class]="confidenceBadgeClass(match()!.confidence)">
                    {{ match()!.confidence }} Confidence
                  </span>
                </div>
              </div>

              <!-- Features from Claude -->
              @if (match()!.features?.length) {
                <div>
                  <p class="text-xs text-sand-dim/70 uppercase tracking-widest mb-2">
                    Observed Features
                  </p>
                  <div class="flex flex-wrap gap-2">
                    @for (f of match()!.features; track f) {
                      <span class="text-xs px-2.5 py-1 rounded-full bg-dark-border text-sand-dim border border-dark-border">
                        {{ f }}
                      </span>
                    }
                  </div>
                </div>
              }

              <!-- Claude's explanation -->
              @if (match()!.rawText) {
                <div class="border-t border-dark-border pt-4">
                  <p class="text-xs text-sand-dim/70 uppercase tracking-widest mb-2">
                    Claude's Analysis
                  </p>
                  <p class="text-sand-dim text-sm leading-relaxed italic">
                    "{{ match()!.rawText }}"
                  </p>
                </div>
              }

              <button class="btn-outline w-full text-sm" (click)="reset()">
                🔄 Try Another Photo
              </button>
            </div>
          }

          <!-- Error -->
          @if (state() === 'error') {
            <div class="flex items-start gap-3 text-red-400">
              <span>⚠️</span>
              <p class="text-sm">{{ errorMessage() }}</p>
            </div>
          }
        </div>
      </div>

      <!-- ── HOW IT WORKS ────────────────────────────────── -->
      <details class="card cursor-pointer">
        <summary class="font-display text-gold/80 text-sm tracking-wide font-semibold select-none">
          How Solution B Works
        </summary>
        <div class="mt-4 text-sand-dim text-sm space-y-2 leading-relaxed">
          <p>
            1. <strong class="text-sand">Image Encoding</strong> — The captured image is
            converted to a base64 JPEG and sent to the Anthropic Messages API.
          </p>
          <p>
            2. <strong class="text-sand">Vision Prompt</strong> — Claude receives the image
            alongside a structured prompt asking it to analyse facial geometry and match
            to one of eight historical pharaohs.
          </p>
          <p>
            3. <strong class="text-sand">JSON Response</strong> — Claude returns a structured
            JSON object with pharaoh name, similarity score (0–100), matched facial features,
            and a short explanation.
          </p>
          <p>
            4. <strong class="text-sand">Enrichment</strong> — The response is merged with
            local pharaoh profile data (dynasty, reign, biography) for the final display.
          </p>
          <p class="text-xs text-amber-400/80">
            ⚠️ The API key is sent from the browser.
            Use a backend proxy for any production deployment.
          </p>
        </div>
      </details>
    </div>
  `,
})
export class ClaudeVisionMatcherComponent implements OnDestroy {
  @ViewChild('videoEl') videoRef!: ElementRef<HTMLVideoElement>;

  readonly state          = signal<AppState>('idle');
  readonly cameraActive   = signal(false);
  readonly capturedDataUrl= signal<string | null>(null);
  readonly match          = signal<PharaohMatch | null>(null);
  readonly errorMessage   = signal('');
  readonly apiKeyMissing  = signal(
    !environment.ANTHROPIC_API_KEY ||
    environment.ANTHROPIC_API_KEY === 'YOUR_ANTHROPIC_API_KEY_HERE',
  );

  sessionApiKey = '';
  private effectiveKey = environment.ANTHROPIC_API_KEY;
  private stream: MediaStream | null = null;

  readonly skeletonLines  = [0, 1, 2, 3, 4];
  readonly skeletonWidths = ['100%', '85%', '70%', '90%', '60%'];

  applySessionKey(): void {
    if (this.sessionApiKey.trim()) {
      this.effectiveKey = this.sessionApiKey.trim();
      this.apiKeyMissing.set(false);
    }
  }

  // ── Camera ────────────────────────────────────────────────
  async startCamera(): Promise<void> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      await new Promise(r => setTimeout(r, 50));
      const video = this.videoRef.nativeElement;
      video.srcObject = this.stream;
      await video.play();
      this.cameraActive.set(true);
      this.capturedDataUrl.set(null);
      this.match.set(null);
      this.state.set('camera-active');
    } catch (err) {
      this.errorMessage.set('Camera denied. ' + (err instanceof Error ? err.message : ''));
      this.state.set('error');
    }
  }

  stopCamera(): void {
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    this.cameraActive.set(false);
    if (this.state() === 'camera-active') this.state.set('idle');
  }

  ngOnDestroy(): void { this.stopCamera(); }

  captureFrame(): void {
    const video  = this.videoRef.nativeElement;
    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')!.drawImage(video, 0, 0);
    this.capturedDataUrl.set(canvas.toDataURL('image/jpeg', 0.85));
    this.stopCamera();
    this.match.set(null);
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

  // ── Claude call ───────────────────────────────────────────
  async analyzeWithClaude(): Promise<void> {
    const dataUrl = this.capturedDataUrl();
    if (!dataUrl || !this.effectiveKey) return;

    this.state.set('analyzing');
    this.match.set(null);
    this.errorMessage.set('');

    try {
      // Strip the data-URL prefix → raw base64
      const base64 = dataUrl.split(',')[1];
      const mediaType = (dataUrl.match(/^data:(image\/\w+);base64,/) ?? [])[1] as
        'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

      const client = new Anthropic({
        apiKey: this.effectiveKey,
      });

      const pharaohNames = PHARAOHS.map(p => p.name).join(', ');

      const response = await client.messages.create({
        model:      'claude-opus-4-5',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              {
                type:   'image',
                source: { type: 'base64', media_type: mediaType, data: base64 },
              },
              {
                type: 'text',
                text: `You are an expert in ancient Egyptian history and facial anthropology.

Analyse the face in this image and determine which famous Egyptian pharaoh the person most resembles.

You MUST choose exactly ONE from this list:
${pharaohNames}

Consider these features:
- Overall face shape (oval / round / elongated / square)
- Jaw shape (strong / weak / wide / narrow)
- Nose (prominent / small / hooked / straight / wide / narrow)
- Eyes (wide-set / close-set / almond / round / large / small)
- Lips (full / thin / wide / narrow)
- Cheekbones (high / low / prominent / soft)
- Forehead height and width

Respond with ONLY a valid JSON object — no markdown fences, no extra text:
{
  "pharaoh": "<exact name from the list>",
  "similarity": <integer 40-95>,
  "mainFeatures": ["<feature 1>", "<feature 2>", "<feature 3>"],
  "explanation": "<1-2 sentence explanation of the resemblance>"
}`,
              },
            ],
          },
        ],
      });

      const text = (response.content[0] as { type: string; text: string }).text.trim();
      const parsed = JSON.parse(text) as ClaudeResponsePayload;
      this.buildMatch(parsed);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errorMessage.set('Claude API error: ' + msg);
      this.state.set('error');
    }
  }

  private buildMatch(payload: ClaudeResponsePayload): void {
    const pharaoh =
      PHARAOHS.find(p =>
        p.name.toLowerCase() === payload.pharaoh.toLowerCase(),
      ) ?? PHARAOHS[0];

    const similarity = Math.max(0, Math.min(100, Math.round(payload.similarity ?? 65)));

    this.match.set({
      pharaoh,
      similarity,
      confidence: scoreToConfidence(similarity),
      features:   payload.mainFeatures ?? [],
      rawText:    payload.explanation ?? '',
    });
    this.state.set('result');
  }

  reset(): void {
    this.capturedDataUrl.set(null);
    this.match.set(null);
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
