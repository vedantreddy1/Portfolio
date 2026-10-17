import React, { useEffect, useRef } from 'react';
const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export default function Turnstile({ siteKey, onToken, resetSignal = 0 }) {
  const holder = useRef(null);
  const widget = useRef(null);
  const callback = useRef(onToken);
  callback.current = onToken;
  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    let widgetId;
    const render = () => {
      if (cancelled || !holder.current || !window.turnstile || widgetId !== undefined) return;
      widgetId = window.turnstile.render(holder.current, {

        sitekey: siteKey, theme: 'light',
        callback: token => callback.current(token),
        'expired-callback': () => { callback.current(''); if(widgetId !== undefined) window.turnstile.reset(widgetId); },
        'error-callback': () => callback.current('')
      });
    };
    let script = document.querySelector('script[data-portfolio-turnstile]');
    if (!script) {
      script = document.createElement('script');
      script.src = SCRIPT;
      script.async = true;
      script.dataset.portfolioTurnstile = '1';
      document.head.appendChild(script);
    }
    script.addEventListener('load', render);
    if (window.turnstile) render();
    widget.current = () => { if (widgetId !== undefined && window.turnstile) window.turnstile.reset(widgetId); };
    return () => {
      cancelled = true;
      widget.current = null;
      script?.removeEventListener('load', render);
      if (widgetId !== undefined && window.turnstile) try { window.turnstile.remove(widgetId); } catch { /* widget removed */ }
    };
  }, [siteKey]);
  useEffect(() => { if (resetSignal) widget.current?.(); }, [resetSignal]);
  return <div ref={holder} className="turnstile-container" aria-label="Spam prevention verification" />;
}
