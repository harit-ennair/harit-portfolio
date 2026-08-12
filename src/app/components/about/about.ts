import {
  Component,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  PLATFORM_ID,
  Inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-about',
  imports: [],
  templateUrl: './about.html',
  styleUrl: './about.css',
})
export class About implements AfterViewInit, OnDestroy {
  private observer: IntersectionObserver | null = null;
  private rafId: number | null = null;

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private hostRef: ElementRef<HTMLElement>
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    if (!('IntersectionObserver' in window)) return;

    const host = this.hostRef.nativeElement;

    // Enable CSS animation state
    host.setAttribute('data-reveal-ready', '');

    const setup = () => {
      const targets = host.querySelectorAll<HTMLElement>('.reveal');

      this.observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              (entry.target as HTMLElement).classList.add('visible');
              this.observer?.unobserve(entry.target);
            }
          });
        },
        {
          threshold: 0.01,
          rootMargin: '100px 0px 100px 0px',
        }
      );

      targets.forEach((el) => this.observer!.observe(el));

      // Also immediately reveal anything already visible in the viewport
      targets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('visible');
        }
      });
    };

    // Two rAF ticks to ensure layout is complete
    this.rafId = requestAnimationFrame(() => {
      this.rafId = requestAnimationFrame(setup);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }
}
