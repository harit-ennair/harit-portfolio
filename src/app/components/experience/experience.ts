import {
  Component,
  AfterViewInit,
  OnDestroy,
  ElementRef,
  PLATFORM_ID,
  Inject,
  HostListener,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  employmentType: string;
  period: string;
  duration: string;
  location?: string;
  workMode?: string;
  linkedInUrl: string;
  description: string;
  highlights?: string[];
  skills: string[];
  photos?: { src: string; caption: string }[];
  accentColor: string;
  icon: string;
}

@Component({
  selector: 'app-experience',
  imports: [CommonModule],
  templateUrl: './experience.html',
  styleUrl: './experience.css',
})
export class Experience implements AfterViewInit, OnDestroy {
  private observer: IntersectionObserver | null = null;
  private rafId: number | null = null;

  // Active Lightbox State
  isGalleryOpen = false;
  activeGalleryPhotos: { src: string; caption: string }[] = [];
  activePhotoIndex = 0;
  activeGalleryTitle = '';

  experiences: ExperienceItem[] = [
    {
      id: 'youcode',
      role: 'Full Stack Developer',
      company: 'YouCode Maroc',
      employmentType: 'Full-time',
      period: 'Oct 2024 - Aug 2026',
      duration: '1 yr 11 mos',
      linkedInUrl:
        'https://www.linkedin.com/in/harit-ennair/details/experience/edit/forms/2554603529/',
      description:
        'My journey at YouCode was a hands-on experience focused on learning through real-world projects and continuous practice. Throughout the program, I worked on web development projects, database design, backend development, frontend interfaces, API integration, teamwork, and problem-solving challenges. The project-based and collaborative approach helped me develop strong technical and soft skills while learning how to work in an environment close to the professional world.',
      skills: [
        'Web Development',
        'Backend Development',
        'Frontend Development',
        'Database Design & SQL',
        'API Development',
        'Git & GitHub',
        'Problem Solving',
        'Agile & Teamwork',
        'Peer Programming',
        'Self-Learning & Research',
        'Communication & Presentation',
      ],
      photos: [
        {
          src: 'images/experiences/youcode/509760150_18058068011520588_4117577981319461555_n.jpg',
          caption: 'YouCode campus & collaborative learning environment',
        },
        {
          src: 'images/experiences/youcode/516290956_18059625266520588_5007220740607988336_n.jpg',
          caption: 'Hands-on coding session and project teamwork',
        },
        {
          src: 'images/experiences/youcode/548897614_18066946106520588_6195246233972344767_n.jpg',
          caption: 'Peer programming and software architecture workshop',
        },
        {
          src: 'images/experiences/youcode/549724087_18066946097520588_6149979534656484670_n.jpg',
          caption: 'Team collaboration and full-stack development sprint',
        },
        {
          src: 'images/experiences/youcode/614854111_18079995311520588_2375173721436619987_n.jpg',
          caption: 'Project presentation and technical showcase',
        },
        {
          src: 'images/experiences/youcode/WhatsApp Image 2026-08-13 at 10.51.55 AM.jpeg',
          caption: 'YouCode developer community and team activities',
        },
      ],
      accentColor: '#3b82f6', // Electric blue accent
      icon: 'code',
    },
    {
      id: 'aptiv',
      role: 'Web Development Intern',
      company: 'Aptiv',
      employmentType: 'Full-time',
      period: 'May 2025 - Jul 2025',
      duration: '3 mos',
      location: 'Tangier, Tanger-Tetouan-Al Hoceima, Morocco',
      workMode: 'On-site',
      linkedInUrl:
        'https://www.linkedin.com/in/harit-ennair/details/experience/edit/forms/2740042150/',
      description:
        'Designed and developed a full-stack training and assessment platform with Laravel 10, including multi-role authentication, advanced quiz modules, progress tracking, responsive dashboards, and real-time reporting to streamline employee competency testing in manufacturing environments.',
      skills: ['Laravel 10', 'PHP', 'MySQL', 'AJAX', 'Communication'],
      accentColor: '#ef4444', // Aptiv crimson red accent
      icon: 'briefcase',
    },
    {
      id: 'nkoon',
      role: 'Nkoon by Cultur.Ed',
      company: 'Cultur.Ed',
      employmentType: 'Full-time',
      period: 'Sep 2022 - Jul 2024',
      duration: '1 yr 11 mos',
      location: 'Youssoufia, Marrakesh-Safi, Morocco',
      workMode: 'On-site',
      linkedInUrl:
        'https://www.linkedin.com/in/harit-ennair/details/experience/edit/forms/2554608505/',
      description:
        'My experience with Nkoon by Cultur.Ed was a journey of creativity, self-discovery, and collaboration. Throughout the program, I took part in activities such as photography, creative workshops, group discussions, cultural activities, teamwork challenges, and interactive sessions. These experiences encouraged me to step outside my comfort zone, express my ideas, and explore new ways of seeing and understanding the world. Through Nkoon, I developed valuable skills in communication, creativity, teamwork, leadership, critical thinking, adaptability, problem-solving, and self-confidence.',
      highlights: [
        'Écriture',
        'Débat & Art oratoire',
        'Photographie & Vidéographie',
        'Improvisation théâtrale',
        'Musique & Chant',
        'Chorégraphie & Expression corporelle',
        'Design & Créativité',
        'Arts manuels',
        'Exploration du patrimoine culturel, artistique et intellectuel du Maroc',
        'Projets créatifs en groupe',
        'Organisation et participation à des événements culturels',
      ],
      skills: [
        'Communication & public speaking',
        'Teamwork & collaboration',
        'Creativity & problem-solving',
        'Leadership & initiative',
        'Self-confidence',
        'Adaptability & open-mindedness',
        'Critical thinking',
      ],
      photos: [
        {
          src: 'images/experiences/cultured/8G8A2100.JPG',
          caption: 'Cultur.Ed creative workshop session',
        },
        {
          src: 'images/experiences/cultured/0P8A0245.JPG',
          caption: 'Cultural exploration and group performance',
        },
        {
          src: 'images/experiences/cultured/0P8A0291.JPG',
          caption: 'Teamwork challenge and leadership workshop',
        },
        {
          src: 'images/experiences/cultured/0P8A3874.JPG',
          caption: 'Photography and visual arts session',
        },
        {
          src: 'images/experiences/cultured/0P8A3900.JPG',
          caption: 'Creative expression and debate session',
        },
        {
          src: 'images/experiences/cultured/1737379475177.jpg',
          caption: 'Group discussion and collaborative ideation',
        },
        {
          src: 'images/experiences/cultured/1737379475314.jpg',
          caption: 'Interactive workshop at Cultur.Ed',
        },
        {
          src: 'images/experiences/cultured/1737379476086.jpg',
          caption: 'Cultural event organization',
        },
        {
          src: 'images/experiences/cultured/1737379476669.jpg',
          caption: 'Team building activities and artistic project',
        },
        {
          src: 'images/experiences/cultured/1737379483596.jpg',
          caption: 'Creative writing and theatre improvisation',
        },
        {
          src: 'images/experiences/cultured/1737379484797.jpg',
          caption: 'Moroccan cultural heritage exploration',
        },
        {
          src: 'images/experiences/cultured/1737379486317.jpg',
          caption: 'Group performance and showcase',
        },
        {
          src: 'images/experiences/cultured/1737379489351.jpg',
          caption: 'Creative art and design workshop',
        },
        {
          src: 'images/experiences/cultured/DSC00388.JPG',
          caption: 'Youth empowerment and public speaking event',
        },
        {
          src: 'images/experiences/cultured/DSC01571.JPG',
          caption: 'Group creative challenge presentation',
        },
        {
          src: 'images/experiences/cultured/DSC08426.JPG',
          caption: 'Nkoon by Cultur.Ed cohort celebration',
        },
      ],
      accentColor: '#10b981', // Vibrant emerald accent
      icon: 'sparkles',
    },
  ];

  constructor(
    @Inject(PLATFORM_ID) private platformId: object,
    private hostRef: ElementRef<HTMLElement>
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const host = this.hostRef.nativeElement;

    const revealElements = () => {
      const targets = host.querySelectorAll<HTMLElement>('.reveal');
      targets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 100 && rect.bottom > -100) {
          el.classList.add('visible');
        }
      });
    };

    // Enable CSS animation state
    host.setAttribute('data-reveal-ready', '');

    if ('IntersectionObserver' in window) {
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
          rootMargin: '150px 0px 150px 0px',
        }
      );

      targets.forEach((el) => this.observer!.observe(el));
    }

    // Immediately reveal visible items and schedule backup check
    revealElements();
    this.rafId = requestAnimationFrame(() => {
      revealElements();
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
  }

  // Lightbox Gallery Methods
  openGallery(exp: ExperienceItem, initialIndex = 0): void {
    if (!exp.photos || exp.photos.length === 0) return;
    this.activeGalleryPhotos = exp.photos;
    this.activePhotoIndex = initialIndex;
    this.activeGalleryTitle = `${exp.role} — ${exp.company}`;
    this.isGalleryOpen = true;

    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = 'hidden';
    }
  }

  closeGallery(): void {
    this.isGalleryOpen = false;
    if (isPlatformBrowser(this.platformId)) {
      document.body.style.overflow = '';
    }
  }

  nextPhoto(): void {
    if (this.activeGalleryPhotos.length === 0) return;
    this.activePhotoIndex =
      (this.activePhotoIndex + 1) % this.activeGalleryPhotos.length;
  }

  prevPhoto(): void {
    if (this.activeGalleryPhotos.length === 0) return;
    this.activePhotoIndex =
      (this.activePhotoIndex - 1 + this.activeGalleryPhotos.length) %
      this.activeGalleryPhotos.length;
  }

  selectPhoto(index: number): void {
    if (index >= 0 && index < this.activeGalleryPhotos.length) {
      this.activePhotoIndex = index;
    }
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (!this.isGalleryOpen) return;

    if (event.key === 'Escape') {
      this.closeGallery();
    } else if (event.key === 'ArrowRight') {
      this.nextPhoto();
    } else if (event.key === 'ArrowLeft') {
      this.prevPhoto();
    }
  }
}
