import { Component } from '@angular/core';
import { MediapipeMatcherComponent } from './components/mediapipe-matcher/mediapipe-matcher.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MediapipeMatcherComponent],
  template: `
    <div class="min-h-screen flex flex-col bg-pharaoh-bg">

      <!-- ── HEADER ─────────────────────────────────────────── -->
      <header class="relative z-10 border-b border-dark-border bg-dark-card/80 backdrop-blur-sm">
        <div class="max-w-5xl mx-auto px-4 py-4 flex items-center gap-4">

          <!-- Egyptian Eye of Horus icon -->
          <div class="shrink-0 text-gold">
            <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M4 22 C10 10, 34 10, 40 22 C34 34, 10 34, 4 22Z"
                    stroke="currentColor" stroke-width="2" fill="none"/>
              <circle cx="22" cy="22" r="7" stroke="currentColor" stroke-width="2" fill="none"/>
              <circle cx="22" cy="22" r="3" fill="currentColor"/>
              <path d="M29 22 L38 30" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <path d="M6 17 C14 12, 30 12, 38 17" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
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

          <div class="ml-auto hidden sm:flex gap-3 text-gold-dim opacity-60 text-xl select-none" aria-hidden="true">
            <span>𓂀</span><span>𓆣</span><span>𓋴</span>
          </div>
        </div>
      </header>

      <!-- ── CONTENT ────────────────────────────────────────── -->
      <main class="flex-1 max-w-5xl w-full mx-auto px-4 py-8">

        <div class="flex items-center gap-4 mb-8 opacity-40">
          <div class="h-px flex-1 bg-gradient-to-r from-transparent to-gold"></div>
          <span class="text-gold text-xs tracking-widest font-display select-none">𓋴 𓌀 𓆣</span>
          <div class="h-px flex-1 bg-gradient-to-l from-transparent to-gold"></div>
        </div>

        <div class="animate-fade-in">
          <app-mediapipe-matcher />
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
export class AppComponent {}
