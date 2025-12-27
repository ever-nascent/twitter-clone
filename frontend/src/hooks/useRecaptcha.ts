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
      // reCAPTCHA not configured - skip loading
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
      // reCAPTCHA v3 loaded successfully
    };

    script.onerror = () => {
      // Failed to load reCAPTCHA script - form validation will fall back to server-side only
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
