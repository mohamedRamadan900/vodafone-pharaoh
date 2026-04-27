import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FaceApiMatcherComponent } from './components/face-api-matcher/face-api-matcher.component';
import { ClaudeVisionMatcherComponent } from './components/claude-vision-matcher/claude-vision-matcher.component';
import { MediapipeMatcherComponent } from './components/mediapipe-matcher/mediapipe-matcher.component';

type Tab = 'a' | 'b' | 'c';

interface TabDef {
  id: Tab;
  label: string;
  sublabel: string;
  icon: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FaceApiMatcherComponent,
    ClaudeVisionMatcherComponent,
    MediapipeMatcherComponent,
  ],
  template: `
    <!-- ═══════════════════ FULL-PAGE SHELL ═══════════════════ -->
    <div class="min-h-screen flex flex-col bg-pharaoh-bg">

      <!-- ── HEADER ─────────────────────────────────────────── -->
      <header class="relative z-10 border-b border-dark-border bg-dark-card/80 backdrop-blur-sm">
        <div class="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">

          <!-- Egyptian Eye of Horus icon -->
          <div class="shrink-0 text-gold">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <!-- Outer eye shape -->
              <path d="M4 22 C10 10, 34 10, 40 22 C34 34, 10 34, 4 22Z"
                    stroke="currentColor" stroke-width="2" fill="none"/>
              <!-- Iris -->
              <circle cx="22" cy="22" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
              <!-- Pupil -->
              <circle cx="22" cy="22" r="3" fill="currentColor"/>
              <!-- Tear drop (kohl line) -->
              <path d="M29 22 L38 30" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <!-- Brow -->
              <path d="M6 17 C14 12, 30 12, 38 17" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              <!-- Lower decorative line -->
              <path d="M15 29 L22 34 L29 29" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>

          <div>
            <h1 class="font-display text-2xl sm:text-3xl font-bold text-gold tracking-widest leading-none">
              PHARAOH MATCHER
            </h1>
            <p class="text-sand-dim text-xs tracking-[0.2em] mt-0.5 font-body">
              DISCOVER YOUR ANCIENT EGYPTIAN TWIN
            </p>
          </div>

          <!-- Decorative right corner glyphs -->
          <div class="ml-auto hidden sm:flex gap-3 text-gold-dim opacity-60 text-xl select-none" aria-hidden="true">
            <span>𓂀</span><span>𓆣</span><span>𓋴</span>
          </div>
        </div>
      </header>

      <!-- ── TABS ───────────────────────────────────────────── -->
      <nav class="border-b border-dark-border bg-dark-card/60 backdrop-blur-sm sticky top-0 z-10">
        <div class="max-w-5xl mx-auto px-4">
          <div class="flex flex-col sm:flex-row">
            @for (tab of tabs; track tab.id) {
              <button
                (click)="activeTab.set(tab.id)"
                [class]="tabClass(tab.id)"
                [attr.aria-selected]="activeTab() === tab.id"
                role="tab"
              >
                <span class="text-lg mb-0.5 sm:mb-0 sm:mr-2">{{ tab.icon }}</span>
                <span class="flex flex-col sm:flex-row sm:items-baseline sm:gap-2 text-left">
                  <span class="text-sm font-semibold font-display tracking-wide">{{ tab.label }}</span>
                  <span class="text-xs opacity-60">{{ tab.sublabel }}</span>
                </span>
                @if (activeTab() === tab.id) {
                  <span class="tab-active-bar"></span>
                }
              </button>
            }
          </div>
        </div>
      </nav>

      <!-- ── TAB CONTENT ────────────────────────────────────── -->
      <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">

        <!-- Decorative top rule -->
        <div class="flex items-center gap-4 mb-8 opacity-40">
          <div class="h-px flex-1 bg-gradient-to-r from-transparent to-gold"></div>
          <span class="text-gold text-xs tracking-widest font-display select-none">𓋴 𓌀 𓆣</span>
          <div class="h-px flex-1 bg-gradient-to-l from-transparent to-gold"></div>
        </div>

        <!-- Component container -->
        <div class="animate-fade-in">
          @if (activeTab() === 'a') {
            <app-face-api-matcher />
          }
          @if (activeTab() === 'b') {
            <app-claude-vision-matcher />
          }
          @if (activeTab() === 'c') {
            <app-mediapipe-matcher />
          }
        </div>
      </main>

      <!-- ── FOOTER ─────────────────────────────────────────── -->
      <footer class="border-t border-dark-border py-4 text-center text-sand-dim text-xs tracking-wide opacity-60">
        <span class="select-none">𓂀 &nbsp;</span>
        Pharaoh Matcher &mdash; For entertainment purposes only
        <span class="select-none">&nbsp; 𓂀</span>
      </footer>
    </div>
  `,
})
export class AppComponent {
  readonly activeTab = signal<Tab>('a');

  readonly tabs: TabDef[] = [
    { id: 'a', label: 'Solution A',  sublabel: 'Local AI',      icon: '🤖' },
    { id: 'b', label: 'Solution B',  sublabel: 'Claude Vision', icon: '👁️' },
    { id: 'c', label: 'Solution C',  sublabel: 'MediaPipe',     icon: '📡' },
  ];

  tabClass(id: Tab): string {
    const base =
      'relative flex flex-row sm:flex-row items-center gap-2 sm:gap-0 px-5 py-3 sm:py-4 ' +
      'transition-all duration-200 border-b-2 sm:border-b-0 cursor-pointer ' +
      'focus:outline-none focus-visible:ring-2 focus-visible:ring-gold';
    const active =
      'text-gold-light border-gold sm:border-transparent font-semibold';
    const inactive =
      'text-sand-dim border-transparent hover:text-sand hover:bg-white/5';
    return `${base} ${this.activeTab() === id ? active : inactive}`;
  }
}
