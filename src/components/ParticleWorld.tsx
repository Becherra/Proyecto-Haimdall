"use client";

import * as THREE from "three";
import { useEffect, useRef, useState } from "react";
import { generateFibonacciSphere, getParticleColor, isLandPixel, sampleWholeSurface, type ParticlePosition } from "../lib/ui/particleGeometry";

const TEXTURE_URL = "/textures/earth-bluemarble-2048.jpg";
const VERTEX_SHADER = `
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  uniform highp float uPixelRatio;
  uniform float uCameraDistance;
  varying vec3 vColor;
  varying float vFresnel;
  varying float vFacing;
  varying float vLight;
  varying float vSize;
  varying float vSeed;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 normal = normalize(normalMatrix * normalize(position));
    vec3 viewDirection = normalize(-viewPosition.xyz);
    vFacing = dot(normal, viewDirection);
    vFresnel = pow(1.0 - max(dot(normal, viewDirection), 0.0), 2.0);
    vLight = 0.12 + max(dot(normal, normalize(vec3(-0.35, 0.3, 1.0))), 0.0) * 0.88;
    vColor = aColor;
    vSize = aSize * uPixelRatio * (uCameraDistance / max(0.1, -viewPosition.z));
    vSeed = aSeed;
    gl_PointSize = vSize;
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const FRAGMENT_SHADER = `
  precision mediump float;
  uniform float uOpacity;
  uniform highp float uPixelRatio;
  uniform float uTriangle;
  varying vec3 vColor;
  varying float vFresnel;
  varying float vFacing;
  varying float vLight;
  varying float vSize;
  varying float vSeed;
  float segmentDistance(vec2 point, vec2 start, vec2 end) {
    vec2 delta = end - start;
    float amount = clamp(dot(point - start, delta) / dot(delta, delta), 0.0, 1.0);
    return length(point - (start + amount * delta));
  }
  void main() {
    if (vFacing < 0.0) discard;
    float alpha = 1.0;
    if (uTriangle > 0.5) {
      vec2 point = (gl_PointCoord - 0.5) * vSize;
      float angle = vSeed * 6.2831853;
      point = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * point;
      vec2 a = vec2(-0.42, -0.32) * vSize;
      vec2 b = vec2(0.42, -0.32) * vSize;
      vec2 c = vec2(0.0, 0.44) * vSize;
      float edge = min(segmentDistance(point, a, b), min(segmentDistance(point, b, c), segmentDistance(point, c, a)));
      alpha = 1.0 - smoothstep(1.0 * uPixelRatio, 1.9 * uPixelRatio, edge);
      if (alpha < 0.02) discard;
    } else if (distance(gl_PointCoord, vec2(0.5)) > 0.5) {
      discard;
    }
    float rim = 0.28 + 1.25 * vFresnel;
    float lighting = 0.16 + 0.84 * vLight;
    gl_FragColor = vec4(vColor * lighting * (0.58 + 0.55 * vFresnel), alpha * uOpacity * rim);
  }
`;

type TextureMask = { pixels: Uint8ClampedArray; width: number; height: number };
type LayerKind = "triangle" | "point";

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

function isLandPosition(position: ParticlePosition, mask: TextureMask | null): boolean {
  if (!mask) return true;
  const u = (Math.atan2(position[2], position[0]) / (Math.PI * 2) + 1) % 1;
  const v = 0.5 - Math.asin(position[1]) / Math.PI;
  const x = Math.min(mask.width - 1, Math.floor(u * mask.width));
  const y = Math.min(mask.height - 1, Math.floor(v * mask.height));
  const pixel = (y * mask.width + x) * 4;
  return isLandPixel(mask.pixels[pixel], mask.pixels[pixel + 1], mask.pixels[pixel + 2]);
}

function createParticleLayer(
  positions: ParticlePosition[],
  kind: LayerKind,
  pixelRatio: number,
  opacity: number,
): THREE.Points {
  const count = positions.length;
  const xyz = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const seeds = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  positions.forEach((position, index) => {
    const pointColor = new THREE.Color(getParticleColor(position));
    xyz.set(position, index * 3);
    sizes[index] = kind === "triangle" ? 10 + (index % 7) : 1 + (index % 2);
    seeds[index] = fract(Math.sin((index + 1) * 78.233) * 43758.5453);
    colors.set([pointColor.r, pointColor.g, pointColor.b], index * 3);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(xyz, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: pixelRatio },
      uCameraDistance: { value: 3.5 },
      uOpacity: { value: opacity },
      uTriangle: { value: kind === "triangle" ? 1 : 0 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Points(geometry, material);
}

function fract(value: number): number {
  return value - Math.floor(value);
}

function createLandPositions(target: number, mask: TextureMask | null): ParticlePosition[] {
  const candidates = generateFibonacciSphere(target * 6);
  return sampleWholeSurface(candidates.filter((position) => isLandPosition(position, mask)), target);
}

export default function ParticleWorld({ stage = "settled" }: { stage?: string }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);
  const [fps, setFps] = useState(0);
  const [renderError, setRenderError] = useState(false);
  const triangleCount = isMobile ? 1500 : 3500;
  const pointCount = isMobile ? 4000 : 9000;

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
      queueMicrotask(() => setRenderError(true));
      return;
    }
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.className = "absolute inset-0 h-full w-full pointer-events-none";
    renderer.domElement.setAttribute("role", "img");
    renderer.domElement.setAttribute("aria-label", "Tierra formada por partículas triangulares y puntos de luz");
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    const world = new THREE.Group();
    scene.add(world);

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const layers: THREE.Points[] = [];
    let cancelled = false;
    let frame = 0;
    let lastFpsUpdate = performance.now();
    let frameCount = 0;
    let previousFrame = performance.now();

    void loadTextureMask().then((mask) => {
      if (cancelled) return;
      const land = createLandPositions(triangleCount, mask);
      const ocean = generateFibonacciSphere(pointCount, 0.995);
      const ambient = generateFibonacciSphere(16, 1.2).map((position, index) => {
        const color = index % 3 === 0 ? "#ffb829" : index % 3 === 1 ? "#8052ff" : "#15846e";
        const point = new THREE.Vector3(...position).multiplyScalar(1.18 + (index % 5) * 0.04);
        return { position: [point.x, point.y, point.z] as ParticlePosition, color };
      });
      const triangles = createParticleLayer(land, "triangle", pixelRatio, 0.9);
      const points = createParticleLayer(ocean, "point", pixelRatio, 0.46);
      const floatingTriangles = createParticleLayer(ambient.map((item) => item.position), "triangle", pixelRatio, 0.34);
      const ambientColors = floatingTriangles.geometry.getAttribute("aColor") as THREE.BufferAttribute;
      ambient.forEach((item, index) => {
        const color = new THREE.Color(item.color);
        ambientColors.setXYZ(index, color.r, color.g, color.b);
      });
      layers.push(triangles, points, floatingTriangles);
      world.add(triangles, points, floatingTriangles);
    });

    const render = (now: number) => {
      if (cancelled) return;
      frame = window.requestAnimationFrame(render);
      const delta = Math.min((now - previousFrame) / 1000, 0.05);
      previousFrame = now;
      if (!document.hidden) {
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) world.rotation.y += delta * 0.035;
        renderer.render(scene, camera);
      }
      frameCount += 1;
      if (now - lastFpsUpdate >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = now;
      }
    };
    frame = window.requestAnimationFrame(render);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      layers.forEach((layer) => {
        layer.geometry.dispose();
        if (Array.isArray(layer.material)) layer.material.forEach((material) => material.dispose());
        else layer.material.dispose();
      });
      world.clear();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [isMobile, pointCount, triangleCount]);

  return <div ref={hostRef} data-intro-stage={stage} className={`particle-world pointer-events-none absolute inset-0 overflow-hidden particle-stage-${stage}`}>
    {renderError ? <p className="absolute inset-x-4 bottom-4 text-center text-xs text-silver-mist" role="alert">No fue posible iniciar WebGL para la vista de partículas.</p> : <output className="absolute bottom-3 right-3 z-10 rounded-full border border-white/10 bg-black/70 px-3 py-1.5 font-mono text-[10px] text-silver-mist" aria-live="off">
      {triangleCount.toLocaleString("es-CO")} triángulos · {pointCount.toLocaleString("es-CO")} puntos · {fps || "—"} FPS
    </output>}
  </div>;
}
