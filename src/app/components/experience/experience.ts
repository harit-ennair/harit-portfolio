import {
    Component,
    AfterViewInit,
    OnDestroy,
    ElementRef,
    PLATFORM_ID,
    Inject,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
    selector: 'app-experience',
    imports: [],
    templateUrl: './experience.html',
    styleUrl: './experience.css',
})
export class Experience implements AfterViewInit, OnDestroy {
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
                { threshold: 0.01, rootMargin: '100px 0px 100px 0px' }
            );

            targets.forEach((el) => {
                const rect = el.getBoundingClientRect();
                if (rect.top < window.innerHeight && rect.bottom > 0) {
                    el.classList.add('visible');
                } else {
                    this.observer!.observe(el);
                }
            });
        };

        this.rafId = requestAnimationFrame(() => {
            this.rafId = requestAnimationFrame(setup);
        });
    }

    ngOnDestroy(): void {
        this.observer?.disconnect();
        this.observer = null;
        if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    }
}
