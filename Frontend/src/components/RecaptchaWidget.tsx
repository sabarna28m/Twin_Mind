import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    grecaptcha?: {
      render: (
        container: HTMLElement,
        params: {
          sitekey: string;
          theme?: 'light' | 'dark';
          callback?: (token: string) => void;
          'expired-callback'?: () => void;
        }
      ) => number;
      reset: (widgetId?: number) => void;
    };
  }
}

interface Props {
  sitekey: string;
  onChange: (token: string | null) => void;
}

export default function RecaptchaWidget({ sitekey, onChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef  = useRef<number | null>(null);
  const aliveRef     = useRef(true);

  useEffect(() => {
    aliveRef.current = true;

    function tryRender() {
      if (!aliveRef.current) return;
      if (!containerRef.current) return;
      if (widgetIdRef.current !== null) return;
      if (!window.grecaptcha?.render) return;

      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey,
        theme: 'dark',
        callback: (token: string) => { if (aliveRef.current) onChange(token); },
        'expired-callback': ()      => { if (aliveRef.current) onChange(null); },
      });
    }

    // grecaptcha may already be ready (cached load), or we poll until the script fires
    if (window.grecaptcha?.render) {
      tryRender();
    } else {
      const id = setInterval(() => {
        if (window.grecaptcha?.render) {
          clearInterval(id);
          tryRender();
        }
      }, 100);
      return () => { aliveRef.current = false; clearInterval(id); };
    }

    return () => { aliveRef.current = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', justifyContent: 'center' }}
    />
  );
}
