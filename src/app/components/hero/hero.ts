import {
  Component,
  Input,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  ElementRef,
  Inject,
  PLATFORM_ID,
  NgZone,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/* -------------------------------------------------------------------------- */
/*  What this draws                                                           */
/*                                                                            */
/*  A black hole, with the light bent the way a black hole bends it.          */
/*                                                                            */
/*  Nothing here is a picture of a ring laid over a disc. Every pixel fires    */
/*  one ray out of the camera and walks it backwards through curved space      */
/*  until the ray either falls through the horizon, leaves for the stars, or   */
/*  cuts the gas disc — often three or four times over, because a ray can      */
/*  loop the hole and come back. The disc is drawn once. The halo above it,    */
/*  the halo below it, and the hard thin ring hugging the shadow are the same  */
/*  disc seen again through bent light. That is why they line up: nobody       */
/*  lined them up.                                                            */
/*                                                                            */
/*  Units are set by the horizon: r = 1 is the event horizon. Then the photon  */
/*  sphere sits at 1.5, the shadow the camera sees is 2.6 across the radius,   */
/*  and the disc starts at 3 — the innermost orbit gas can hold in this        */
/*  geometry. Those numbers are not tuned. They fall out of the metric.        */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*  Shaders                                                                   */
/* -------------------------------------------------------------------------- */

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const SCENE_FRAG = `
precision highp float;

#define MAX_STEPS 460
#define WIND_CYCLE 46.0

varying vec2 vUv;

uniform vec2  uRes;
uniform float uTime;
uniform vec3  uCamPos;
uniform vec3  uRight;
uniform vec3  uUp;
uniform vec3  uFwd;
uniform float uTanHalf;
uniform vec2  uFocus;
uniform float uSteps;
uniform float uSkyR;
uniform float uDiskIn;
uniform float uDiskOut;
uniform float uThick;
uniform float uDensity;
uniform float uSpin;
uniform float uGrain;
uniform float uBright;
uniform float uDoppler;
uniform vec3  uHot;
uniform vec3  uMid;
uniform vec3  uCool;
uniform float uStars;
uniform float uEncode;
uniform vec2  uJitter;
uniform float uSeed;

float hash13(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float vnoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(
    mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
    mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
    f.z
  );
}

float fbm(vec3 p, float lod) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) {
    s += (i == 3 ? a * lod : a) * vnoise(p);
    p = p * 2.03 + vec3(11.3, 7.1, 3.7);
    a *= 0.5;
  }
  return s;
}

void gasAt(vec3 p, float rd, float dt, out float dens, out vec3 tint, out float heat) {
  float rn = clamp((rd - uDiskIn) / max(0.001, uDiskOut - uDiskIn), 0.0, 1.0);
  float tk = uThick * (0.35 + 1.25 * rn);
  float v = p.y / tk;
  float sheet = exp(-v * v);
  float lod = clamp(1.0 - dt * uGrain * 14.0, 0.0, 1.0);

  float phi = atan(p.z, p.x);
  float omega = uSpin * pow(uDiskIn / rd, 1.5);
  float lr = log(rd) * 1.1 + uSpin * uTime * 0.05;

  float u = uTime / WIND_CYCLE;
  float fA = fract(u);
  float fB = fract(u + 0.5);
  float w = abs(2.0 * fA - 1.0);

  float cloudsA = fbm(vec3(vec2(cos(phi + omega * fA * WIND_CYCLE),
                                sin(phi + omega * fA * WIND_CYCLE)) * (rd * uGrain), lr), lod);
  float cloudsB = fbm(vec3(vec2(cos(phi + omega * fB * WIND_CYCLE),
                                sin(phi + omega * fB * WIND_CYCLE)) * (rd * uGrain), lr + 40.0), lod);
  float clouds = mix(cloudsA, cloudsB, w);

  float filaments = clouds * clouds * 1.75;
  float inner = smoothstep(0.0, 0.07, rn);
  float outer = 1.0 - smoothstep(0.45, 1.0, rn);
  float prof = inner * outer * pow(uDiskIn / rd, 2.0);

  dens = max(0.0, filaments * 1.5 - 0.30) * sheet * prof * uDensity * 4.6;

  heat = pow(uDiskIn / rd, 0.8) * (0.72 + 0.55 * clouds);
  tint = mix(uCool, uMid, smoothstep(0.10, 0.52, heat));
  tint = mix(tint, uHot, smoothstep(0.52, 1.05, heat));
}

vec3 starField(vec3 d) {
  vec3 a = abs(d);
  vec2 uv;
  float face;
  if (a.x >= a.y && a.x >= a.z)      { uv = d.yz / a.x; face = d.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z)               { uv = d.xz / a.y; face = d.y > 0.0 ? 2.0 : 3.0; }
  else                               { uv = d.xy / a.z; face = d.z > 0.0 ? 4.0 : 5.0; }

  vec3 col = vec3(0.0);
  for (int k = 0; k < 3; k++) {
    float sc = 90.0 * pow(2.2, float(k));
    vec2 p = uv * sc;
    vec2 id = floor(p);
    vec2 f = fract(p) - 0.5;
    float h = hash13(vec3(id, face * 19.0));
    if (h > 0.965) {
      vec2 off = vec2(hash13(vec3(id, face + 11.0)), hash13(vec3(id, face + 23.0)));
      float dd = length(f - (off - 0.5) * 0.7);
      float s = smoothstep(0.055, 0.0, dd);
      float warm = hash13(vec3(id, face + 51.0));
      col += s * (0.6 + 4.5 * fract(h * 97.0))
           * mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.88, 0.72), warm)
           / pow(2.2, float(k));
    }
  }
  col += vec3(0.013, 0.017, 0.030) * fbm(d * 2.6, 1.0);
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy + uJitter - uFocus * uRes) / uRes.y;
  vec3 dir = normalize(uFwd + (uv.x * uRight + uv.y * uUp) * 2.0 * uTanHalf);

  vec3 pos = uCamPos;
  vec3 vel = dir;

  vec3 hv = cross(pos, vel);
  float h2 = dot(hv, hv);
  float h = sqrt(h2);
  float swept = 0.0;

  vec3 col = vec3(0.0);
  float transmit = 1.0;
  bool captured = false;

  float jitter = fract(sin(dot(gl_FragCoord.xy + uSeed, vec2(12.9898, 78.233))) * 43758.5453);

  for (int i = 0; i < MAX_STEPS; i++) {
    if (float(i) >= uSteps) break;

    float r2 = dot(pos, pos);
    float r = sqrt(r2);

    if (r < 1.0) { captured = true; break; }
    if (r > uSkyR && dot(pos, vel) > 0.0) break;
    if (transmit < 0.004) break;

    float dt = clamp(0.14 * (r - 1.0), 0.025, 1.1);

    if (r < uDiskOut * 1.25) {
      float rn = clamp((r - uDiskIn) / max(0.001, uDiskOut - uDiskIn), 0.0, 1.0);
      float tk = uThick * (0.35 + 1.25 * rn);
      dt = min(dt, max(tk * 0.38, abs(pos.y) * 0.5));
    }

    swept += h * dt / r2;

    float deep = exp(-1.3 * max(0.0, swept - 4.6));

    jitter = fract(jitter + 0.6180339887);
    vec3 mid = pos + vel * (dt * jitter);
    float rd = length(mid.xz);

    if (rd > uDiskIn && rd < uDiskOut && abs(mid.y) < uThick * 5.0) {
      float dens;
      float heat;
      vec3 tint;
      gasAt(mid, rd, dt, dens, tint, heat);

      if (dens > 0.001) {
        vec3 tang = normalize(cross(vec3(0.0, 1.0, 0.0), vec3(mid.x, 0.0, mid.z)));
        float beta = min(0.85, sqrt(0.5 / max(rd, 1.5)));
        float gam = inversesqrt(max(1e-4, 1.0 - beta * beta));
        vec3 toObs = -normalize(vel);
        float g = 1.0 / (gam * (1.0 - beta * dot(tang, toObs)));
        g *= sqrt(max(0.05, 1.0 - 1.0 / rd));
        float boost = pow(max(g, 0.02), 3.0 * uDoppler);

        vec3 shift = mix(
          vec3(1.0),
          g > 1.0 ? vec3(0.86, 0.94, 1.14) : vec3(1.15, 0.82, 0.62),
          clamp(abs(g - 1.0) * 1.6, 0.0, 1.0) * uDoppler
        );

        float emit = uBright * (0.26 + 2.0 * heat * heat);
        col += tint * shift * (emit * boost * dens * transmit * dt * deep);
        transmit *= exp(-dens * 0.30 * dt);
      }
    }

    vec3 acc = -1.5 * h2 * pos / (r2 * r2 * r);
    vel += acc * dt;
    pos += vel * dt;
  }

  if (!captured && uStars > 0.001) {
    vec3 toHole = normalize(-uCamPos);
    float sI = length(cross(normalize(dir), toHole));
    float sS = length(cross(normalize(vel), toHole));
    float stretch = clamp(sI / max(1e-3, sS), 1.0, 40.0);
    col += starField(normalize(vel)) * uStars * transmit / stretch;
  }

  if (uEncode > 0.5) col = col / (1.0 + col);
  gl_FragColor = vec4(col, 1.0);
}
`;

const BLEND_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uCur;
uniform sampler2D uPrev;
uniform float uAlpha;

void main() {
  vec3 c = texture2D(uCur, vUv).rgb;
  vec3 p = texture2D(uPrev, vUv).rgb;
  gl_FragColor = vec4(mix(p, c, uAlpha), 1.0);
}
`;

const BRIGHT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uDecode;
uniform float uPack;
uniform float uThreshold;

void main() {
  vec3 s = texture2D(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture2D(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb
         + texture2D(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb
         + texture2D(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  s *= 0.25;
  if (uDecode > 0.5) s = s / max(vec3(0.002), 1.0 - s);
  float l = max(s.r, max(s.g, s.b));
  s *= max(0.0, l - uThreshold) / max(0.0001, l);
  gl_FragColor = vec4(s * uPack, 1.0);
}
`;

const BLUR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uStep;

void main() {
  vec3 s = texture2D(uTex, vUv).rgb * 0.2270270;
  s += (texture2D(uTex, vUv + uStep * 1.3846154).rgb
      + texture2D(uTex, vUv - uStep * 1.3846154).rgb) * 0.3162162;
  s += (texture2D(uTex, vUv + uStep * 3.2307692).rgb
      + texture2D(uTex, vUv - uStep * 3.2307692).rgb) * 0.0702702;
  gl_FragColor = vec4(s, 1.0);
}
`;

const COMPOSITE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform vec2  uRes;
uniform float uDecode;
uniform float uPack;
uniform float uGlow;
uniform float uExposure;
uniform float uVignette;
uniform float uScrimDir;
uniform float uScrimAmt;
uniform float uSeed;

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec3 scene = texture2D(uScene, vUv).rgb;
  if (uDecode > 0.5) scene = scene / max(vec3(0.002), 1.0 - scene);
  vec3 bloom = texture2D(uBloom, vUv).rgb / uPack;

  vec3 c = scene + bloom * uGlow;
  c = aces(c * uExposure);
  c = pow(max(c, 0.0), vec3(0.4545));

  vec2 d = vUv - 0.5;
  c *= 1.0 - uVignette * dot(d, d) * 1.9;

  if (uScrimDir > 0.5) {
    float x = uScrimDir < 1.5 ? vUv.x
            : uScrimDir < 2.5 ? 1.0 - vUv.x
            : uScrimDir < 3.5 ? 1.0 - vUv.y
            : vUv.y;
    c *= 1.0 - uScrimAmt * pow(1.0 - clamp(x, 0.0, 1.0), 2.4);
  }

  float n = fract(sin(dot(gl_FragCoord.xy + uSeed, vec2(12.9898, 78.233))) * 43758.5453);
  c += (n - 0.5) / 255.0;

  gl_FragColor = vec4(c, 1.0);
}
`;

/* -------------------------------------------------------------------------- */
/*  Small helpers                                                             */
/* -------------------------------------------------------------------------- */

const RAD = Math.PI / 180;

function hexToLinear(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const full =
    h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h.slice(0, 6);
  const n = parseInt(full, 16);
  const srgb = [
    ((n >> 16) & 255) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ];
  return srgb.map((v) =>
    v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  ) as [number, number, number];
}

interface Prog {
  program: WebGLProgram;
  u: Record<string, WebGLUniformLocation | null>;
}

interface Target {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                 */
/* -------------------------------------------------------------------------- */

@Component({
  selector: 'app-hero',
  imports: [],
  templateUrl: './hero.html',
  styleUrl: './hero.css',
})
export class Hero implements AfterViewInit, OnDestroy {
  /* --- Inputs (same defaults as the React original) --- */
  @Input() distance = 24;
  @Input() elevation = -5.5;
  @Input() azimuth = 0;
  @Input() orbitSpeed = 0;
  @Input() roll = -20;
  @Input() fov = 42;
  @Input() diskInner = 3;
  @Input() diskOuter = 15;
  @Input() diskThickness = 0.26;
  @Input() diskDensity = 1;
  @Input() brightness = 1;
  @Input() spinSpeed = 0.06;
  @Input() grain = 0.48;
  @Input() doppler = 0.35;
  @Input() hotColor = '#E0F2FF';
  @Input() midColor = '#2196F3';
  @Input() coolColor = '#063B73';
  @Input() starBrightness = 0;
  @Input() glow = 1;
  @Input() exposure = 0.9;
  @Input() vignette = 0.28;
  @Input() steps = 300;
  @Input() resolution = 0.7;
  @Input() maxDpr = 1.75;
  @Input() focusPoint: [number, number] = [0.72, 0.46];
  @Input() scrim: 'none' | 'left' | 'right' | 'top' | 'bottom' = 'left';
  @Input() scrimStrength = 0.9;
  @Input() paused = false;

  @ViewChild('heroHost', { static: false }) hostRef!: ElementRef<HTMLDivElement>;
  @ViewChild('heroCanvas', { static: false }) canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('heroTagline', { static: false }) taglineRef!: ElementRef<HTMLParagraphElement>;

  narrow = false;

  private isBrowser: boolean;
  private running = false;
  private raf = 0;
  private ro: ResizeObserver | null = null;
  private io: IntersectionObserver | null = null;
  private onVisibility: (() => void) | null = null;
  private onLost: ((e: Event) => void) | null = null;
  private onRestored: (() => void) | null = null;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;

  // GL resources — cleaned up in ngOnDestroy
  private sceneProg: Prog | null = null;
  private blendProg: Prog | null = null;
  private brightProg: Prog | null = null;
  private blurProg: Prog | null = null;
  private compProg: Prog | null = null;
  private vbo: WebGLBuffer | null = null;
  private scene: Target | null = null;
  private histA: Target | null = null;
  private histB: Target | null = null;
  private bloomA: Target | null = null;
  private bloomB: Target | null = null;
  private settled = 0;

  private width = 0;
  private height = 0;
  private sceneW = 0;
  private sceneH = 0;

  private hdr = true;
  private texType!: number;
  private internal!: number;
  private filter!: number;
  private pack = 1;

  private clock = 0;
  private lastFrame = 0;
  private visible = true;
  private reduced = false;
  private software = false;
  private isGL2 = false;

  // Typewriter animation
  private twDelay: ReturnType<typeof setTimeout> | null = null;

  constructor(
    @Inject(PLATFORM_ID) platformId: Object,
    private ngZone: NgZone
  ) {
    this.isBrowser = isPlatformBrowser(platformId);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    // Responsive: check for narrow viewport
    if (typeof window.matchMedia === 'function') {
      const mq = window.matchMedia('(max-width: 767px)');
      this.narrow = mq.matches;
      mq.addEventListener('change', (e) => {
        this.narrow = e.matches;
        this.applyResponsiveDefaults();
      });
    }
    this.applyResponsiveDefaults();

    this.reduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (this.reduced) this.clock = 6;

    const host = this.hostRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    const opts: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false,
    };
    const gl = (canvas.getContext('webgl2', opts) ||
      canvas.getContext('webgl', opts)) as
      | WebGL2RenderingContext
      | WebGLRenderingContext
      | null;

    if (!gl) {
      this.giveUp('unsupported');
      return;
    }
    this.gl = gl;

    const dbg = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = dbg
      ? String(gl.getParameter((dbg as any).UNMASKED_RENDERER_WEBGL) || '')
      : '';
    this.software = /swiftshader|llvmpipe|softpipe|software|microsoft basic/i.test(renderer);
    this.isGL2 =
      typeof WebGL2RenderingContext !== 'undefined' &&
      gl instanceof WebGL2RenderingContext;

    // HDR setup
    this.hdr = true;
    this.texType = gl.UNSIGNED_BYTE;
    this.internal = gl.RGBA;
    if (this.isGL2) {
      const g2 = gl as WebGL2RenderingContext;
      const ok =
        g2.getExtension('EXT_color_buffer_half_float') ||
        g2.getExtension('EXT_color_buffer_float');
      if (ok) {
        this.texType = g2.HALF_FLOAT;
        this.internal = g2.RGBA16F;
      } else {
        this.hdr = false;
      }
    } else {
      const hf = gl.getExtension('OES_texture_half_float');
      const cb = gl.getExtension('EXT_color_buffer_half_float');
      if (hf && cb) {
        this.texType = (hf as any).HALF_FLOAT_OES;
      } else {
        this.hdr = false;
      }
    }
    if (!this.hdr) {
      this.texType = gl.UNSIGNED_BYTE;
      this.internal = gl.RGBA;
    }
    const linearOK =
      this.isGL2 ||
      !!gl.getExtension('OES_texture_half_float_linear') ||
      !this.hdr;
    this.filter = linearOK ? gl.LINEAR : gl.NEAREST;
    this.pack = this.hdr ? 1 : 0.12;

    if (!this.build()) {
      this.giveUp('build-failed');
      return;
    }
    this.resize();
    this.settle(this.reduced ? 16 : 1);

    // Run the animation loop outside Angular's zone to avoid triggering
    // change detection on every frame (~60 times/sec).
    this.ngZone.runOutsideAngular(() => {
      if (!this.reduced) {
        this.running = true;
        this.raf = requestAnimationFrame((t) => this.tick(t));
      }
    });

    // Observers
    this.ro = new ResizeObserver(() => {
      this.resize();
      if (this.reduced || this.paused) this.settle(16);
    });
    this.ro.observe(host);

    this.io = new IntersectionObserver(
      (entries) => {
        this.visible = entries[0]?.isIntersecting ?? true;
      },
      { threshold: 0 }
    );
    this.io.observe(host);

    this.onVisibility = () => {
      this.visible = !document.hidden;
      this.lastFrame = 0;
    };
    document.addEventListener('visibilitychange', this.onVisibility);

    this.onLost = (e: Event) => {
      e.preventDefault();
      this.running = false;
      cancelAnimationFrame(this.raf);
      canvas.style.display = 'none';
    };
    canvas.addEventListener('webglcontextlost', this.onLost);

    this.onRestored = () => {
      this.width = this.height = this.sceneW = this.sceneH = 0;
      if (!this.build()) {
        this.giveUp('lost');
        return;
      }
      canvas.style.display = '';
      host.dataset['webgl'] = '';
      this.resize();
      this.running = true;
      this.lastFrame = 0;
      this.settle(this.reduced ? 16 : 1);
      if (!this.reduced) {
        this.raf = requestAnimationFrame((t) => this.tick(t));
      }
    };
    canvas.addEventListener('webglcontextrestored', this.onRestored);

    // Kick off typewriter animation for the tagline
    this.ngZone.runOutsideAngular(() => this.startTypewriter());
  }

  ngOnDestroy(): void {
    if (!this.isBrowser) return;
    this.running = false;
    cancelAnimationFrame(this.raf);
    if (this.twDelay !== null) clearTimeout(this.twDelay);
    this.ro?.disconnect();
    this.io?.disconnect();
    if (this.onVisibility) {
      document.removeEventListener('visibilitychange', this.onVisibility);
    }
    const canvas = this.canvasRef?.nativeElement;
    if (canvas) {
      if (this.onLost) canvas.removeEventListener('webglcontextlost', this.onLost);
      if (this.onRestored) canvas.removeEventListener('webglcontextrestored', this.onRestored);
    }
    this.dropTargets();
    const gl = this.gl;
    if (gl) {
      if (this.vbo) gl.deleteBuffer(this.vbo);
      for (const p of [this.sceneProg, this.blendProg, this.brightProg, this.blurProg, this.compProg]) {
        if (p) gl.deleteProgram(p.program);
      }
    }
  }

  /* --- responsive helpers ------------------------------------------------- */

  private applyResponsiveDefaults(): void {
    if (this.narrow) {
      this.focusPoint = [0.5, 0.76];
      this.scrim = 'top';
      this.elevation = -7;
      this.fov = 58;
      this.glow = 0.85;
      this.steps = 200;
      this.resolution = 0.6;
    } else {
      this.focusPoint = [0.72, 0.46];
      this.scrim = 'left';
      this.elevation = -5.5;
      this.fov = 42;
      this.glow = 1;
      this.steps = 300;
      this.resolution = 0.7;
    }
  }

  /* --- typewriter --------------------------------------------------------- */

  private startTypewriter(): void {
    const el = this.taglineRef?.nativeElement;
    if (!el) return;

    const phrases = [
      'Creative developer crafting digital experiences at the intersection of design and technology.',
      'Turning ideas into elegant, performant web applications.',
      'Passionate about clean code, great design, and everything in between.',
      'Building things that live on the internet — one pixel at a time.',
    ];

    const TYPE_SPEED   = 35;   // ms per character typed
    const ERASE_SPEED  = 18;   // ms per character erased (faster feels natural)
    const PAUSE_AFTER  = 2200; // ms to hold the completed phrase
    const PAUSE_BEFORE = 500;  // ms to pause before typing the next phrase

    let phraseIndex = 0;
    let charIndex   = 0;
    let erasing     = false;

    el.textContent = '';
    el.classList.add('tw-cursor');

    const tick = () => {
      const current = phrases[phraseIndex];

      if (!erasing) {
        // — typing —
        charIndex++;
        el.textContent = current.slice(0, charIndex);

        if (charIndex >= current.length) {
          // Finished typing → pause, then start erasing
          erasing = true;
          this.twDelay = setTimeout(tick, PAUSE_AFTER);
          return;
        }
        this.twDelay = setTimeout(tick, TYPE_SPEED);
      } else {
        // — erasing —
        charIndex--;
        el.textContent = current.slice(0, charIndex);

        if (charIndex <= 0) {
          // Finished erasing → move to next phrase
          erasing = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          this.twDelay = setTimeout(tick, PAUSE_BEFORE);
          return;
        }
        this.twDelay = setTimeout(tick, ERASE_SPEED);
      }
    };

    // Initial delay before the first phrase starts
    this.twDelay = setTimeout(tick, 800);
  }

  /* --- GL helpers --------------------------------------------------------- */

  private giveUp(why: string): void {
    const host = this.hostRef?.nativeElement;
    const canvas = this.canvasRef?.nativeElement;
    if (host) host.dataset['webgl'] = why;
    if (canvas) canvas.style.display = 'none';
  }

  private compile(type: number, src: string): WebGLShader | null {
    const gl = this.gl!;
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error('blackhole: shader failed —', gl.getShaderInfoLog(sh) || 'no log (context lost?)');
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  private link(fragSrc: string): Prog | null {
    const gl = this.gl!;
    const vs = this.compile(gl.VERTEX_SHADER, VERT);
    const fs = this.compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!vs || !fs) return null;
    const program = gl.createProgram();
    if (!program) return null;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'aPos');
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(program));
      return null;
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(program, i);
      if (info) u[info.name] = gl.getUniformLocation(program, info.name);
    }
    return { program, u };
  }

  private makeTarget(w: number, h: number): Target | null {
    const gl = this.gl!;
    const tex = gl.createTexture();
    const fb = gl.createFramebuffer();
    if (!tex || !fb) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, this.internal, w, h, 0, gl.RGBA, this.texType, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, this.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteTexture(tex);
      gl.deleteFramebuffer(fb);
      return null;
    }
    return { fb, tex, w, h };
  }

  private build(): boolean {
    const gl = this.gl!;
    this.sceneProg = this.link(SCENE_FRAG);
    this.blendProg = this.link(BLEND_FRAG);
    this.brightProg = this.link(BRIGHT_FRAG);
    this.blurProg = this.link(BLUR_FRAG);
    this.compProg = this.link(COMPOSITE_FRAG);
    if (!this.sceneProg || !this.blendProg || !this.brightProg || !this.blurProg || !this.compProg) {
      return false;
    }
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    return true;
  }

  private dropTargets(): void {
    const gl = this.gl;
    if (!gl) return;
    for (const t of [this.scene, this.histA, this.histB, this.bloomA, this.bloomB]) {
      if (!t) continue;
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fb);
    }
    this.scene = null;
    this.histA = null;
    this.histB = null;
    this.bloomA = null;
    this.bloomB = null;
    this.settled = 0;
  }

  private resize(): void {
    const host = this.hostRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const rect = host.getBoundingClientRect();
    const dpr = this.software
      ? 1
      : Math.min(window.devicePixelRatio || 1, Math.max(1, this.maxDpr));
    const cssW = Math.max(1, Math.round(rect.width));
    const cssH = Math.max(1, Math.round(rect.height));
    const scale = this.software ? 0.34 : Math.min(1, Math.max(0.4, this.resolution));
    const w = Math.max(2, Math.round(cssW * dpr));
    const h = Math.max(2, Math.round(cssH * dpr));
    const sw = Math.max(2, Math.round(w * scale));
    const sh = Math.max(2, Math.round(h * scale));
    if (w === this.width && h === this.height && sw === this.sceneW && sh === this.sceneH) return;
    this.width = w;
    this.height = h;
    this.sceneW = sw;
    this.sceneH = sh;
    canvas.width = w;
    canvas.height = h;
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    this.dropTargets();
    this.scene = this.makeTarget(sw, sh);
    this.histA = this.makeTarget(sw, sh);
    this.histB = this.makeTarget(sw, sh);
    const bw = Math.max(2, sw >> 2);
    const bh = Math.max(2, sh >> 2);
    this.bloomA = this.makeTarget(bw, bh);
    this.bloomB = this.makeTarget(bw, bh);
  }

  /* --- rendering ---------------------------------------------------------- */

  private readonly HALTON: Array<[number, number]> = [
    [0.5, 0.333], [0.25, 0.667], [0.75, 0.111], [0.125, 0.444],
    [0.625, 0.778], [0.375, 0.222], [0.875, 0.556], [0.0625, 0.889],
  ];

  private pass(prog: Prog, target: Target | null): void {
    const gl = this.gl!;
    gl.useProgram(prog.program);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fb : null);
    gl.viewport(0, 0, target ? target.w : this.width, target ? target.h : this.height);
  }

  private draw(): void {
    this.gl!.drawArrays(this.gl!.TRIANGLES, 0, 3);
  }

  private bind(tex: WebGLTexture, unit: number): void {
    const gl = this.gl!;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  private render(t: number): void {
    const gl = this.gl!;
    if (!this.sceneProg || !this.blendProg || !this.brightProg || !this.blurProg || !this.compProg) return;
    if (!this.scene || !this.histA || !this.histB || !this.bloomA || !this.bloomB) return;

    const az = (this.azimuth + this.orbitSpeed * t) * RAD;
    const el = Math.max(-88, Math.min(88, this.elevation)) * RAD;
    const dist = Math.max(2.2, this.distance);
    const ce = Math.cos(el);
    const camX = dist * ce * Math.cos(az);
    const camY = dist * Math.sin(el);
    const camZ = dist * ce * Math.sin(az);

    const fx = -camX / dist, fy = -camY / dist, fz = -camZ / dist;
    let rx = fz, ry = 0, rz = -fx;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl; ry /= rl; rz /= rl;
    let ux = ry * fz - rz * fy;
    let uy = rz * fx - rx * fz;
    let uz = rx * fy - ry * fx;
    const cr = Math.cos(this.roll * RAD);
    const sr = Math.sin(this.roll * RAD);
    const RX = rx * cr + ux * sr, RY = ry * cr + uy * sr, RZ = rz * cr + uz * sr;
    const UX = -rx * sr + ux * cr, UY = -ry * sr + uy * cr, UZ = -rz * sr + uz * cr;

    const hot = hexToLinear(this.hotColor);
    const mid = hexToLinear(this.midColor);
    const cool = hexToLinear(this.coolColor);
    const outer = Math.max(this.diskInner + 0.5, this.diskOuter);

    /* scene */
    this.pass(this.sceneProg, this.scene);
    const u = this.sceneProg.u;
    gl.uniform2f(u['uRes']!, this.scene.w, this.scene.h);
    gl.uniform1f(u['uTime']!, t);
    gl.uniform3f(u['uCamPos']!, camX, camY, camZ);
    gl.uniform3f(u['uRight']!, RX, RY, RZ);
    gl.uniform3f(u['uUp']!, UX, UY, UZ);
    gl.uniform3f(u['uFwd']!, fx, fy, fz);
    gl.uniform1f(u['uTanHalf']!, Math.tan(Math.max(8, Math.min(110, this.fov)) * 0.5 * RAD));
    gl.uniform2f(u['uFocus']!, this.focusPoint[0], 1 - this.focusPoint[1]);
    gl.uniform1f(
      u['uSteps']!,
      this.software ? 130 : Math.max(60, Math.min(460, Math.round(this.steps)))
    );
    gl.uniform1f(u['uSkyR']!, Math.max(dist * 1.35, outer * 2.4));
    gl.uniform1f(u['uDiskIn']!, Math.max(1.05, this.diskInner));
    gl.uniform1f(u['uDiskOut']!, outer);
    gl.uniform1f(u['uThick']!, Math.max(0.02, this.diskThickness));
    gl.uniform1f(u['uDensity']!, Math.max(0, this.diskDensity));
    gl.uniform1f(u['uSpin']!, this.spinSpeed * 6.2831853);
    gl.uniform1f(u['uGrain']!, Math.max(0.02, this.grain));
    gl.uniform1f(u['uBright']!, Math.max(0, this.brightness));
    gl.uniform1f(u['uDoppler']!, Math.max(0, Math.min(1, this.doppler)));
    gl.uniform3f(u['uHot']!, hot[0], hot[1], hot[2]);
    gl.uniform3f(u['uMid']!, mid[0], mid[1], mid[2]);
    gl.uniform3f(u['uCool']!, cool[0], cool[1], cool[2]);
    gl.uniform1f(u['uStars']!, Math.max(0, this.starBrightness));
    gl.uniform1f(u['uEncode']!, this.hdr ? 0 : 1);
    const h = this.HALTON[this.settled % this.HALTON.length];
    gl.uniform2f(u['uJitter']!, h[0] - 0.5, h[1] - 0.5);
    gl.uniform1f(u['uSeed']!, (this.settled % 64) * 17.13);
    this.draw();

    /* fold into the running average */
    const alpha = this.settled === 0 ? 1 : 0.14;
    this.pass(this.blendProg, this.histB);
    this.bind(this.scene.tex, 0);
    this.bind(this.histA.tex, 1);
    gl.uniform1i(this.blendProg.u['uCur']!, 0);
    gl.uniform1i(this.blendProg.u['uPrev']!, 1);
    gl.uniform1f(this.blendProg.u['uAlpha']!, alpha);
    this.draw();
    const shown = this.histB;
    const tmp = this.histA;
    this.histA = this.histB;
    this.histB = tmp;
    this.settled++;

    /* bright pass */
    this.pass(this.brightProg, this.bloomA);
    this.bind(shown.tex, 0);
    gl.uniform1i(this.brightProg.u['uTex']!, 0);
    gl.uniform2f(this.brightProg.u['uTexel']!, 1 / shown.w, 1 / shown.h);
    gl.uniform1f(this.brightProg.u['uDecode']!, this.hdr ? 0 : 1);
    gl.uniform1f(this.brightProg.u['uPack']!, this.pack);
    gl.uniform1f(this.brightProg.u['uThreshold']!, 0.85);
    this.draw();

    /* two rounds of blur */
    const blurStep = (src: Target, dst: Target, dx: number, dy: number) => {
      this.pass(this.blurProg!, dst);
      this.bind(src.tex, 0);
      gl.uniform1i(this.blurProg!.u['uTex']!, 0);
      gl.uniform2f(this.blurProg!.u['uStep']!, dx / dst.w, dy / dst.h);
      this.draw();
    };
    blurStep(this.bloomA!, this.bloomB!, 1, 0);
    blurStep(this.bloomB!, this.bloomA!, 0, 1);
    blurStep(this.bloomA!, this.bloomB!, 2.6, 0);
    blurStep(this.bloomB!, this.bloomA!, 0, 2.6);

    /* composite */
    this.pass(this.compProg, null);
    this.bind(shown.tex, 0);
    this.bind(this.bloomA!.tex, 1);
    gl.uniform1i(this.compProg.u['uScene']!, 0);
    gl.uniform1i(this.compProg.u['uBloom']!, 1);
    gl.uniform2f(this.compProg.u['uRes']!, this.width, this.height);
    gl.uniform1f(this.compProg.u['uDecode']!, this.hdr ? 0 : 1);
    gl.uniform1f(this.compProg.u['uPack']!, this.pack);
    gl.uniform1f(this.compProg.u['uGlow']!, Math.max(0, this.glow) * 0.26);
    gl.uniform1f(this.compProg.u['uExposure']!, Math.max(0.05, this.exposure));
    gl.uniform1f(this.compProg.u['uVignette']!, Math.max(0, Math.min(1, this.vignette)));
    gl.uniform1f(
      this.compProg.u['uScrimDir']!,
      this.scrim === 'left' ? 1 : this.scrim === 'right' ? 2 : this.scrim === 'top' ? 3 : this.scrim === 'bottom' ? 4 : 0
    );
    gl.uniform1f(this.compProg.u['uScrimAmt']!, Math.max(0, Math.min(1, this.scrimStrength)));
    gl.uniform1f(this.compProg.u['uSeed']!, (t * 60) % 1000);
    this.draw();
  }

  private settle(passes: number): void {
    for (let i = 0; i < passes; i++) this.render(this.clock);
  }

  private tick(now: number): void {
    if (!this.running) return;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    if (!this.visible) {
      this.lastFrame = now;
      return;
    }
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 0;
    this.lastFrame = now;
    if (!this.paused && !this.reduced) this.clock += dt;
    this.render(this.clock);
  }
}
