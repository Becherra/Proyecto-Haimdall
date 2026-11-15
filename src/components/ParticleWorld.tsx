"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { generateFibonacciSphere, getParticleColor, isLandPixel, type ParticlePosition } from "../lib/ui/particleGeometry";
import { HERO_TIMELINE } from "../lib/ui/heroTimeline";

const TEXTURE_URL = "/textures/earth-bluemarble-2048.jpg";
/** react-globe.gl usa fov 50 y, a altitud 2.5, la cámara queda a 3.5 radios del centro. */
const GLOBE_FOV_DEG = 50;
const GLOBE_DISTANCE = 3.5;
const T = HERO_TIMELINE;

const VERTEX_SHADER = `
  // Mantiene la precisión de uniforms y varyings igual al fragment shader en WebGL.
  precision mediump float;
  attribute vec3 aStart;
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  attribute float aLand;
  uniform float uPixelRatio;
  uniform float uCameraDistance;
  uniform float uAssemble;
  uniform float uBurst;
  uniform float uTime;
  uniform vec2 uSpread;
  uniform vec2 uOffset;
  varying vec3 vColor;
  varying float vFresnel;
  varying float vFacing;
  varying float vLight;
  varying float vSize;
  varying float vEase;
  varying float vLand;
  varying float vPulse;
  mat2 rot(float a) { float c = cos(a); float s = sin(a); return mat2(c, -s, s, c); }
  void main() {
    // Cada punto sale en un momento distinto y llega con ease-out.
    float delay = fract(aSeed * 13.37) * 0.45;
    float t = clamp((uAssemble - delay) / 0.55, 0.0, 1.0);
    float e = 1.0 - pow(1.0 - t, 3.0);
    vec3 start = vec3(uOffset + aStart.xy * uSpread, aStart.z * 2.0);
    vec3 p = mix(start, position, e);
    p.xz = rot((1.0 - e) * 0.8 * (0.5 + aSeed)) * p.xz; // espiral al llegar
    p += (1.0 - e) * 0.08 * vec3(sin(uTime * 0.9 + aSeed * 40.0), cos(uTime * 0.7 + aSeed * 25.0), sin(uTime * 0.6 + aSeed * 31.0));
    p *= 1.0 + uBurst * (0.25 + aSeed * 0.55); // explosión suave al final

    vec4 viewPosition = modelViewMatrix * vec4(p, 1.0);
    vec3 normal = normalize(normalMatrix * normalize(position));
    vec3 viewDirection = normalize(-viewPosition.xyz);
    float facing = dot(normal, viewDirection);
    // volando se ven todos; ya ensamblados se oculta la cara trasera de la esfera
    vFacing = mix(1.0, smoothstep(-0.02, 0.12, facing), smoothstep(0.55, 1.0, e));
    vFresnel = pow(1.0 - max(facing, 0.0), 2.0);
    vLight = 0.12 + max(dot(normal, normalize(vec3(-0.35, 0.3, 1.0))), 0.0) * 0.88;
    vColor = aColor;
    vEase = e;
    float pulse = 1.0 + 0.035 * e * sin(uTime * 1.25 + aSeed * 31.0);
    vSize = clamp(aSize * uPixelRatio * min(uCameraDistance / max(0.1, -viewPosition.z), 2.0) * pulse,
                  1.5 * uPixelRatio, 2.5 * uPixelRatio);
    vLand = aLand;
    vPulse = 0.94 + 0.06 * (0.5 + 0.5 * sin(uTime * 1.1 + aSeed * 43.0));
    gl_PointSize = vSize;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vFresnel;
  varying float vFacing;
  varying float vLight;
  varying float vSize;
  varying float vEase;
  varying float vLand;
  varying float vPulse;
  void main() {
    float radius = length((gl_PointCoord - 0.5) * 2.0);
    float disk = 1.0 - smoothstep(0.38, 1.0, radius);
    float glow = 0.13 * exp(-radius * 4.0);
    float alpha = max(disk, glow);
    float rim = mix(1.0, 0.82 + 0.68 * vFresnel, vEase);
    float lighting = mix(1.0, 0.16 + 0.84 * vLight, vEase);
    float visibility = vFacing * mix(0.5, 1.0, vEase);
    float terrainOpacity = mix(0.6, 1.0, vLand);
    vec3 color = vColor * lighting * (0.82 + 0.35 * vFresnel) * 1.2;
    gl_FragColor = vec4(color, alpha * uOpacity * terrainOpacity * rim * visibility * vPulse);
  }
`;

type TextureMask = { pixels: Uint8ClampedArray; width: number; height: number };
type Shared = Record<string, THREE.IUniform>;
type ParticleWorldProps = {
  stage?: string;
  /** performance.now() del inicio de la intro (lo escribe page.tsx cuando llama a onReady). */
  startRef?: { current: number };
  /** Contenedor del globo real: la esfera de puntos se coloca y escala igual que él. */
  anchorRef?: { current: HTMLElement | null };
  onReady?: () => void;
  onError?: () => void;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const smooth = (value: number) => value * value * (3 - 2 * value);
const fract = (value: number) => value - Math.floor(value);

function loadTextureMask(): Promise<TextureMask | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 256;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return resolve(null);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve({ pixels: context.getImageData(0, 0, canvas.width, canvas.height).data, width: canvas.width, height: canvas.height });
      } catch {
        resolve(null);
      }
    };
    image.onerror = () => resolve(null);
    image.src = TEXTURE_URL;
  });
}

/** Mapeo igual al de three-globe: lng 0 / lat 0 mira a la cámara (+Z), el este queda a la derecha. */
function isLandPosition(position: ParticlePosition, mask: TextureMask | null): boolean {
  if (!mask) return true;
  const u = Math.atan2(position[0], position[2]) / (Math.PI * 2) + 0.5;
  const v = 0.5 - Math.asin(Math.max(-1, Math.min(1, position[1]))) / Math.PI;
  const x = Math.min(mask.width - 1, Math.max(0, Math.floor(u * mask.width)));
  const y = Math.min(mask.height - 1, Math.max(0, Math.floor(v * mask.height)));
  const pixel = (y * mask.width + x) * 4;
  return isLandPixel(mask.pixels[pixel], mask.pixels[pixel + 1], mask.pixels[pixel + 2]);
}

function createPointLayer(positions: ParticlePosition[], mask: TextureMask | null, shared: Shared): THREE.Points {
  const count = positions.length;
  const target = new Float32Array(count * 3);
  const start = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);
  const landFlags = new Float32Array(count);
  const color = new THREE.Color();
  positions.forEach((position, index) => {
    const land = isLandPosition(position, mask);
    color.set(land ? getParticleColor(position) : "#303d83");
    target.set(position, index * 3);
    start[index * 3] = Math.random() * 2 - 1;
    start[index * 3 + 1] = Math.random() * 2 - 1;
    start[index * 3 + 2] = Math.random() * 2 - 1;
    seeds[index] = fract(Math.sin((index + 1) * 78.233) * 43758.5453);
    sizes[index] = 1.5 + seeds[index];
    landFlags[index] = land ? 1 : 0;
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(target, 3));
  geometry.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aLand", new THREE.BufferAttribute(landFlags, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: shared,
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false; // las partículas viajan fuera del bounding sphere
  return points;
}

export default function ParticleWorld({ stage = "settled", startRef, anchorRef, onReady, onError }: ParticleWorldProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [fps, setFps] = useState(0);
  const [renderError, setRenderError] = useState(false);
  const isPreview = stage === "preview";
  const [reducedForPerformance, setReducedForPerformance] = useState(false);
  const pointCount = Math.round((isMobile ? 9000 : 22000) * (reducedForPerformance ? 0.7 : 1));

  useEffect(() => { onReadyRef.current = onReady; onErrorRef.current = onError; });

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false, powerPreference: "high-performance" });
    } catch {
      queueMicrotask(() => { setRenderError(true); onErrorRef.current?.(); });
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "absolute inset-0 h-full w-full pointer-events-none";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "Tierra formada por puntos de luz");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(GLOBE_FOV_DEG, 1, 0.1, 100);
    camera.position.set(0, 0, GLOBE_DISTANCE);
    const world = new THREE.Group();
    scene.add(world);

    const shared: Shared = {
      uPixelRatio: { value: pixelRatio },
      uCameraDistance: { value: GLOBE_DISTANCE },
      uAssemble: { value: isPreview ? 1 : 0 },
      uBurst: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: isPreview ? 1 : 0.72 },
      uSpread: { value: new THREE.Vector2(3, 2) },
      uOffset: { value: new THREE.Vector2(0, 0) },
    };

    // El overlay es fullscreen, pero la esfera se centra y escala igual que el contenedor del globo real.
    const resize = () => {
      const rect = host.getBoundingClientRect();
      const width = rect.width;
      const height = rect.height;
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      const anchor = anchorRef?.current?.getBoundingClientRect();
      const hasAnchor = Boolean(anchor && anchor.width && anchor.height);
      const cx = hasAnchor && anchor ? anchor.left + anchor.width / 2 - rect.left : width / 2;
      const cy = hasAnchor && anchor ? anchor.top + anchor.height / 2 - rect.top : height / 2;
      const anchorHeight = hasAnchor && anchor ? anchor.height : height;
      const tanHalf = Math.tan(THREE.MathUtils.degToRad(GLOBE_FOV_DEG / 2)) * (height / anchorHeight);
      camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(tanHalf));
      camera.aspect = width / height;
      camera.setViewOffset(width, height, width / 2 - cx, height / 2 - cy, width, height);
      const unitsPerPixel = (2 * GLOBE_DISTANCE * tanHalf) / height;
      shared.uSpread.value.set((width / 2) * unitsPerPixel, (height / 2) * unitsPerPixel);
      shared.uOffset.value.set((width / 2 - cx) * unitsPerPixel, (cy - height / 2) * unitsPerPixel);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    if (anchorRef?.current) observer.observe(anchorRef.current);
    resize();

    const layers: THREE.Points[] = [];
    let cancelled = false;
    let frame = 0;
    let lastFpsUpdate = performance.now();
    let frameCount = 0;
    let previousFrame = performance.now();
    let warmupUntil = Number.POSITIVE_INFINITY;
    let slowIntervals = 0;

    void loadTextureMask().then((mask) => {
      if (cancelled) return;
      const points = createPointLayer(generateFibonacciSphere(pointCount), mask, shared);
      layers.push(points);
      world.add(points);
      resize();
      lastFpsUpdate = performance.now();
      warmupUntil = lastFpsUpdate + 1500;
      frameCount = 0;
      if (!isPreview) onReadyRef.current?.();
    });

    const resetFpsBaseline = () => {
      lastFpsUpdate = performance.now();
      frameCount = 0;
    };
    document.addEventListener("visibilitychange", resetFpsBaseline);

    const render = () => {
      if (cancelled) return;
      frame = window.requestAnimationFrame(render);
      const nowMs = performance.now();
      const delta = Math.min((nowMs - previousFrame) / 1000, 0.05);
      previousFrame = nowMs;
      if (document.hidden || layers.length === 0) {
        resetFpsBaseline();
        return;
      }

      shared.uTime.value = nowMs / 1000;
      frameCount += 1;
      if (nowMs - lastFpsUpdate >= 1000) {
        const measuredFps = Math.round((frameCount * 1000) / (nowMs - lastFpsUpdate));
        if (isPreview) setFps(measuredFps);
        if (nowMs >= warmupUntil) {
          slowIntervals = measuredFps < 45 ? slowIntervals + 1 : 0;
          if (slowIntervals >= 2 && !reducedForPerformance) setReducedForPerformance(true);
        }
        frameCount = 0;
        lastFpsUpdate = nowMs;
      }

      if (isPreview) {
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) world.rotation.y += delta * 0.035;
      } else {
        const elapsed = startRef && startRef.current ? nowMs - startRef.current : 0;
        const assemble = clamp01((elapsed - T.scatter) / (T.gather - T.scatter));
        const burst = smooth(clamp01((elapsed - T.hold) / (T.explode - T.hold)));
        shared.uAssemble.value = assemble;
        shared.uBurst.value = burst;
        shared.uOpacity.value = (0.72 + 0.28 * smooth(clamp01(elapsed / T.scatter))) * (1 - burst);
        // gira al ensamblarse y termina EXACTAMENTE alineado con el globo real (lng 0, lat 0)
        world.rotation.y = Math.pow(1 - assemble, 2) * 1.2;
      }
      renderer.render(scene, camera);

    };
    frame = window.requestAnimationFrame(render);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener("visibilitychange", resetFpsBaseline);
      layers.forEach((layer) => {
        layer.geometry.dispose();
        if (Array.isArray(layer.material)) layer.material.forEach((material) => material.dispose());
        else layer.material.dispose();
      });
      world.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [isMobile, pointCount, isPreview, startRef, anchorRef, reducedForPerformance]);

  return <div ref={hostRef} data-intro-stage={stage} className={`particle-world pointer-events-none fixed inset-0 z-20 overflow-hidden particle-stage-${stage}`}>
    {renderError
      ? <p className="absolute inset-x-4 bottom-4 text-center text-xs text-silver-mist" role="alert">No fue posible iniciar WebGL para la vista de partículas.</p>
      : isPreview && <output className="fixed bottom-3 right-3 z-10 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 font-mono text-[10px] text-silver-mist" aria-live="off">
        {pointCount.toLocaleString("es-CO")} puntos · {fps || "—"} FPS
      </output>}
  </div>;
}
