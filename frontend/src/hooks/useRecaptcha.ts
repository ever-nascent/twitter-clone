import { useEffect } from 'react';

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

/**
 * Hook to load and initialize Google reCAPTCHA v3
 * Should be called once in the App component
 */
export function useRecaptcha() {
  useEffect(() => {
    // Skip if not configured
    if (!RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY === 'your_recaptcha_site_key_here') {
      console.warn('[CAPTCHA] reCAPTCHA not configured');
      return;
    }

    // Skip if already loaded
    if (document.querySelector('script[src*="google.com/recaptcha"]')) {
      return;
    }

    // Load reCAPTCHA script
    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('[CAPTCHA] reCAPTCHA v3 loaded successfully');
    };

    script.onerror = () => {
      console.error('[CAPTCHA] Failed to load reCAPTCHA script');
    };

    document.head.appendChild(script);

    return () => {
      // Cleanup: remove script on unmount
      const scriptElement = document.querySelector('script[src*="google.com/recaptcha"]');
      if (scriptElement) {
        document.head.removeChild(scriptElement);
      }
    };
  }, []);
}
