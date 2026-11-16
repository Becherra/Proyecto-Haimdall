import { describe, expect, it } from "vitest";
import {
  buildGlobePickLocation,
  cartesianToGeo,
  geoToCartesian,
  GLOBE_PICK_LABEL,
  intersectRaySphere,
  normalizeLongitude,
  pickReliefPoint,
  sampleElevation,
  type Ray,
} from "../src/lib/ui/globePick";
import { calculateMapView } from "../src/lib/ui/mapView";

const R = 100;
const pereira = { lat: 4.8133, lon: -75.6961 };

/** Rayo desde una cámara a `distance` del centro, sobre `target`, mirando al centro del globo. */
function rayLookingAt(target: { lat: number; lon: number }, distance = 350): Ray {
  const origin = geoToCartesian(target, distance);
  return { origin, direction: { x: -origin.x, y: -origin.y, z: -origin.z } };
}

describe("coordenadas del globo", () => {
  it("usa la convención de three-globe: lat 0 / lon 0 mira a +Z y el este es +X", () => {
    const front = geoToCartesian({ lat: 0, lon: 0 }, R);
    expect(front.x).toBeCloseTo(0);
    expect(front.y).toBeCloseTo(0);
    expect(front.z).toBeCloseTo(R);
    expect(geoToCartesian({ lat: 0, lon: 90 }, R).x).toBeCloseTo(R);
    expect(geoToCartesian({ lat: 90, lon: 0 }, R).y).toBeCloseTo(R);
  });

  it("vuelve a la misma lat/lon al ir y volver", () => {
    for (const point of [pereira, { lat: -33.45, lon: -70.66 }, { lat: 64.1, lon: 179.5 }, { lat: -12, lon: -179.9 }]) {
      const back = cartesianToGeo(geoToCartesian(point, 87));
      expect(back.lat).toBeCloseTo(point.lat, 9);
      expect(back.lon).toBeCloseTo(point.lon, 9);
    }
  });

  it("no depende del radio y aguanta los polos", () => {
    expect(cartesianToGeo({ x: 0, y: 5, z: 0 }).lat).toBeCloseTo(90);
    expect(cartesianToGeo({ x: 0, y: -0.2, z: 0 }).lat).toBeCloseTo(-90);
  });

  it("falla con un punto en el centro", () => {
    expect(() => cartesianToGeo({ x: 0, y: 0, z: 0 })).toThrow();
  });

  it("normaliza longitudes fuera de rango", () => {
    expect(normalizeLongitude(190)).toBeCloseTo(-170);
    expect(normalizeLongitude(-540)).toBeCloseTo(-180);
    expect(normalizeLongitude(-75.69)).toBeCloseTo(-75.69);
  });
});

describe("intersectRaySphere", () => {
  it("encuentra la entrada y la salida", () => {
    const hit = intersectRaySphere({ origin: { x: 0, y: 0, z: 300 }, direction: { x: 0, y: 0, z: -1 } }, R);
    expect(hit?.near).toBeCloseTo(200);
    expect(hit?.far).toBeCloseTo(400);
  });

  it("respeta direcciones sin normalizar", () => {
    expect(intersectRaySphere({ origin: { x: 0, y: 0, z: 300 }, direction: { x: 0, y: 0, z: -10 } }, R)?.near).toBeCloseTo(20);
  });

  it("devuelve null si el rayo no toca el globo o apunta hacia afuera", () => {
    expect(intersectRaySphere({ origin: { x: 0, y: 150, z: 300 }, direction: { x: 0, y: 0, z: -1 } }, R)).toBeNull();
    expect(intersectRaySphere({ origin: { x: 0, y: 0, z: 300 }, direction: { x: 0, y: 0, z: 1 } }, R)).toBeNull();
    expect(intersectRaySphere({ origin: { x: 0, y: 0, z: 300 }, direction: { x: 0, y: 0, z: 0 } }, R)).toBeNull();
  });
});

describe("sampleElevation", () => {
  // 4 × 2: fila norte [0, 255, 0, 0], fila sur todo 0. La columna 1 cubre 90°O–0°.
  const grid = { values: [0, 255, 0, 0, 0, 0, 0, 0], width: 4, height: 2 };

  it("lee el centro del pixel y lo escala a 0–1", () => {
    expect(sampleElevation(grid, { lat: 45, lon: -45 })).toBeCloseTo(1);
    expect(sampleElevation(grid, { lat: -45, lon: -45 })).toBeCloseTo(0);
  });

  it("interpola entre vecinos", () => {
    expect(sampleElevation(grid, { lat: 45, lon: 0 })).toBeCloseTo(0.5);
    expect(sampleElevation(grid, { lat: 0, lon: -45 })).toBeCloseTo(0.5);
  });

  it("da la vuelta por el antimeridiano y lee datos RGBA", () => {
    const rgba = { values: [10, 0, 0, 255, 0, 0, 0, 255], width: 2, height: 1, stride: 4, maxValue: 10 };
    expect(sampleElevation(rgba, { lat: 0, lon: -90 })).toBeCloseTo(1);
    expect(sampleElevation(rgba, { lat: 0, lon: 180 })).toBeCloseTo(0.5);
  });

  it("devuelve 0 con una rejilla vacía o incompleta", () => {
    expect(sampleElevation({ values: [], width: 0, height: 0 }, pereira)).toBe(0);
    expect(sampleElevation({ values: [1, 2], width: 4, height: 2 }, pereira)).toBe(0);
  });
});

describe("pickReliefPoint", () => {
  it("en un globo liso devuelve el punto bajo la cámara", () => {
    const picked = pickReliefPoint(rayLookingAt(pereira), { radius: R, maxHeight: 4, heightAt: () => 0 });
    expect(picked?.lat).toBeCloseTo(pereira.lat, 4);
    expect(picked?.lon).toBeCloseTo(pereira.lon, 4);
  });

  it("se detiene en la ladera de una montaña vista de lado, no detrás de ella", () => {
    // Meseta de 4 unidades entre lon 0° y 5°; el rayo baja rasante hacia el este y tocaría la esfera lisa cerca de lon 2°.
    const mountain = { radius: R, maxHeight: 4, heightAt: ({ lon }: { lon: number }) => (lon >= 0 && lon <= 5 ? 1 : 0) };
    const ray: Ray = { origin: { x: -30, y: 0, z: 110 }, direction: { x: 1, y: 0, z: -0.3 } };
    const picked = pickReliefPoint(ray, mountain);
    const flat = intersectRaySphere(ray, R);
    expect(picked?.lat).toBeCloseTo(0);
    expect(picked?.lon).toBeGreaterThanOrEqual(0);
    expect(picked?.lon).toBeLessThan(0.05);
    expect(flat).not.toBeNull();
    const flatLon = cartesianToGeo({ x: -30 + (flat?.near ?? 0), y: 0, z: 110 - 0.3 * (flat?.near ?? 0) }).lon;
    expect(flatLon).toBeGreaterThan(1.5);
  });

  it("devuelve null si el toque cae fuera del globo", () => {
    const ray: Ray = { origin: { x: 0, y: 200, z: 350 }, direction: { x: 0, y: 0, z: -1 } };
    expect(pickReliefPoint(ray, { radius: R, maxHeight: 4, heightAt: () => 1 })).toBeNull();
  });
});

describe("buildGlobePickLocation", () => {
  it("abre el mapa detallado centrado en el punto, con una zona de ±0,05°", () => {
    const location = buildGlobePickLocation({ lat: 4.813345678, lon: -75.696123456 });
    expect(location).toEqual({ lat: 4.81335, lon: -75.69612, label: GLOBE_PICK_LABEL, boundingBox: [4.76335, 4.86335, -75.74612, -75.64612] });
  });

  it("el mapa detallado abre amplio (zoom 12) y pide afinar el punto", () => {
    expect(calculateMapView(buildGlobePickLocation(pereira))).toMatchObject({ targetZoom: 12, showPinHint: true });
  });

  it("recorta la zona en los polos y el antimeridiano", () => {
    const north = buildGlobePickLocation({ lat: 89.99, lon: 179.98 });
    expect(north.boundingBox).toEqual([89.94, 90, 179.93, 180]);
    expect(buildGlobePickLocation({ lat: 0, lon: 200 }).lon).toBe(-160);
  });

  it("rechaza coordenadas inválidas", () => {
    expect(() => buildGlobePickLocation({ lat: Number.NaN, lon: 0 })).toThrow();
  });
});
