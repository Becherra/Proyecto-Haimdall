import { describe, expect, it } from "vitest";
import { pickSpanishVoice, splitForSpeech } from "../src/lib/ui/speech";

describe("pickSpanishVoice", () => {
  it("prefiere es-CO y luego otras variantes latinas", () => {
    expect(pickSpanishVoice([{ lang: "en-US", name: "a" }, { lang: "es-ES", name: "b" }, { lang: "es-MX", name: "c" }])?.name).toBe("c");
    expect(pickSpanishVoice([{ lang: "es-MX", name: "c" }, { lang: "es_CO", name: "d" }])?.name).toBe("d");
  });
  it("acepta cualquier español y devuelve null si no hay", () => {
    expect(pickSpanishVoice([{ lang: "es-AR", name: "x" }])?.name).toBe("x");
    expect(pickSpanishVoice([{ lang: "en-US", name: "a" }])).toBeNull();
    expect(pickSpanishVoice([])).toBeNull();
  });
});

describe("splitForSpeech", () => {
  it("agrupa frases cortas sin pasarse del máximo", () => {
    const chunks = splitForSpeech("Uno. Dos. Tres.", 10);
    expect(chunks.every((chunk) => chunk.length <= 10)).toBe(true);
    expect(chunks.join(" ")).toBe("Uno. Dos. Tres.");
  });
  it("parte una frase larguísima por palabras", () => {
    const text = Array.from({ length: 60 }, () => "palabra").join(" ");
    const chunks = splitForSpeech(text, 50);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 50)).toBe(true);
  });
  it("devuelve vacío con texto vacío", () => {
    expect(splitForSpeech("   ")).toEqual([]);
  });
});
