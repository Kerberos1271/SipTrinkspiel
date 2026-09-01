import { useLayoutEffect, useRef, useState } from 'react';

interface UseFitTextOptions {
  maxFontSize: number;
  minFontSize: number;
}

interface UseFitTextResult<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  fontSize: number;
  isReady: boolean;
}

/** Fits text into a fixed-size element without changing the element's dimensions. */
export function useFitText<T extends HTMLElement>(
  content: unknown,
  { maxFontSize, minFontSize }: UseFitTextOptions,
): UseFitTextResult<T> {
  const ref = useRef<T>(null);
  const [fontSize, setFontSize] = useState(maxFontSize);
  const [isReady, setIsReady] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    fitElement();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(fitElement);
    observer?.observe(element);
    window.addEventListener('resize', fitElement);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', fitElement);
    };

    function fitElement() {
      const currentElement = ref.current;
      if (!currentElement) return;

      const max = Math.max(maxFontSize, minFontSize);
      const min = Math.min(maxFontSize, minFontSize);
      const fits = (size: number) => {
        currentElement.style.fontSize = `${size}px`;
        return currentElement.scrollHeight <= currentElement.clientHeight + 1
          && currentElement.scrollWidth <= currentElement.clientWidth + 1;
      };

      let best = min;
      if (fits(max)) {
        best = max;
      } else if (fits(min)) {
        let low = min;
        let high = max;
        for (let iteration = 0; iteration < 12; iteration += 1) {
          const middle = (low + high) / 2;
          if (fits(middle)) {
            best = middle;
            low = middle;
          } else {
            high = middle;
          }
        }
      }

      const nextFontSize = Math.round(best * 100) / 100;
      currentElement.style.fontSize = `${nextFontSize}px`;
      setFontSize((current) => current === nextFontSize ? current : nextFontSize);
      setIsReady(true);
    }
  }, [content, maxFontSize, minFontSize]);

  return { ref, fontSize, isReady };
}
