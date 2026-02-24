"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseTypewriterOptions {
  text: string;
  speed?: number;
  delay?: number;
  onComplete?: () => void;
  enabled?: boolean;
}

export function useTypewriter({
  text,
  speed = 30,
  delay = 0,
  onComplete,
  enabled = true,
}: UseTypewriterOptions) {
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const reset = useCallback(() => {
    setDisplayedText("");
    setIsComplete(false);
    setIsStarted(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const delayTimer = setTimeout(() => {
      setIsStarted(true);
      let index = 0;

      const interval = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(interval);
          setIsComplete(true);
          onCompleteRef.current?.();
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(delayTimer);
  }, [text, speed, delay, enabled]);

  return { displayedText, isComplete, isStarted, reset };
}
