/**
 * 檔案：src/lib/use-voice-input.ts
 * 角色：前端層 — 語音輸入 hook（Web Speech API，瀏覽器原生，無相依套件）
 * 功能：包 SpeechRecognition／webkitSpeechRecognition，提供
 *       { supported, listening, error, start, stop }。
 *       每次辨識更新會用「這段錄音的累積文字（final + interim）」呼叫 onChange，
 *       由呼叫端決定怎麼併回輸入框。預設語言 zh-TW。
 *       Chrome / Edge / Android Chrome 支援；不支援時 supported=false（按鈕自行隱藏）。
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

const ERROR_TEXT: Record<string, string> = {
  'not-allowed': '麥克風權限被拒，請到瀏覽器網站設定開啟後再試。',
  'service-not-allowed': '瀏覽器不允許使用語音辨識。',
  'audio-capture': '找不到麥克風裝置。',
  network: '語音辨識連線失敗，請檢查網路後再試。',
  'no-speech': '', // 沒聽到聲音，不當作錯誤
  aborted: '',
};

export interface VoiceInput {
  supported: boolean;
  listening: boolean;
  error: string | null;
  start: () => void;
  stop: () => void;
}

export function useVoiceInput({
  lang = 'zh-TW',
  onChange,
}: {
  lang?: string;
  /** 這段錄音目前的累積文字（final + interim），每次更新都會呼叫。 */
  onChange: (sessionText: string) => void;
}): VoiceInput {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const finalRef = useRef('');
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;

    setSupported(true);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setError(null);
      setListening(true);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      const msg = ERROR_TEXT[e.error] ?? '語音辨識發生問題，請再試一次。';
      if (msg) setError(msg);
      setListening(false);
    };
    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const t = r[0]?.transcript ?? '';
        if (r.isFinal) finalRef.current += t;
        else interim += t;
      }
      onChangeRef.current(finalRef.current + interim);
    };

    recRef.current = rec;
    return () => {
      rec.onstart = rec.onend = rec.onerror = rec.onresult = null;
      try {
        rec.abort();
      } catch {
        /* noop */
      }
      recRef.current = null;
    };
  }, [lang]);

  const start = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    finalRef.current = '';
    setError(null);
    try {
      rec.start();
    } catch {
      /* 已在錄音中重複 start 會丟錯，忽略 */
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  return { supported, listening, error, start, stop };
}
