"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SpeechItem } from "../lib/ui/resultsCopy";
import { pickSpanishVoice, splitForSpeech } from "../lib/ui/speech";

const AUDIO_DIR = "/audio";

/** Reproduce la grabación propia; devuelve false si no existe o no se pudo reproducir (entonces se usa la voz del celular). */
function playRecording(audioId: string, setCurrent: (audio: HTMLAudioElement | null) => void): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(`${AUDIO_DIR}/${audioId}.mp3`);
    setCurrent(audio);
    audio.addEventListener("ended", () => resolve(true), { once: true });
    audio.addEventListener("error", () => resolve(false), { once: true });
    audio.play().catch(() => resolve(false));
  });
}

function speakWithDevice(text: string): Promise<void> {
  const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
  if (!synth) return Promise.resolve();
  const voice = pickSpanishVoice(synth.getVoices());
  return splitForSpeech(text).reduce<Promise<void>>((previous, chunk) => previous.then(() => new Promise<void>((resolve) => {
    const utterance = new SpeechSynthesisUtterance(chunk);
    utterance.lang = voice?.lang ?? "es-CO";
    if (voice) utterance.voice = voice;
    utterance.rate = 0.92;
    utterance.onend = () => resolve();
    utterance.onerror = () => resolve();
    synth.speak(utterance);
  })), Promise.resolve());
}

/**
 * Lectura en voz alta de una lista de textos. Si hay grabación propia (`public/audio/<id>.mp3`) suena esa;
 * si no, la voz en español del celular. Solo suena una lectura a la vez; tocar la misma la detiene.
 */
export function useSpeaker() {
  const [playingKey, setPlayingKey] = useState<string | null>(null);
  const token = useRef(0);
  const keyRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stop = useCallback(() => {
    token.current += 1;
    keyRef.current = null;
    audioRef.current?.pause();
    audioRef.current = null;
    window.speechSynthesis?.cancel();
    setPlayingKey(null);
  }, []);

  useEffect(() => () => {
    token.current += 1;
    audioRef.current?.pause();
    window.speechSynthesis?.cancel();
  }, []);

  const play = useCallback(async (key: string, items: readonly SpeechItem[]) => {
    if (keyRef.current === key) { stop(); return; }
    stop();
    const mine = token.current;
    keyRef.current = key;
    setPlayingKey(key);
    for (const item of items) {
      if (token.current !== mine) return;
      const played = item.audioId ? await playRecording(item.audioId, (audio) => { audioRef.current = audio; }) : false;
      if (token.current !== mine) return;
      if (!played) await speakWithDevice(item.text);
    }
    if (token.current === mine) { keyRef.current = null; setPlayingKey(null); }
  }, [stop]);

  return { playingKey, play, stop };
}
