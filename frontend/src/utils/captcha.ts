/**
 * Google reCAPTCHA v3 Client Utility
 *
 * reCAPTCHA v3 is invisible and runs in the background
 * It returns a token that must be verified on the server
 */

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      render: (container: string | HTMLElement, parameters: object) => number;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

/**
 * Execute reCAPTCHA and get token
 * @param action The action name (e.g., 'login', 'register')
 * @returns The reCAPTCHA token to send to the backend
 */
export async function executeRecaptcha(action: string): Promise<string> {
  // If no site key configured, return empty string (for development)
  if (!RECAPTCHA_SITE_KEY || RECAPTCHA_SITE_KEY === 'your_recaptcha_site_key_here') {
    console.warn('[CAPTCHA] reCAPTCHA not configured, skipping');
    return '';
  }

  return new Promise((resolve, reject) => {
    // Wait for reCAPTCHA to be ready
    if (typeof window.grecaptcha === 'undefined') {
      console.error('[CAPTCHA] reCAPTCHA script not loaded');
      return resolve(''); // Fail gracefully
    }

    window.grecaptcha.ready(async () => {
      try {
        const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
          action,
        });
        resolve(token);
      } catch (error) {
        console.error('[CAPTCHA] Error executing reCAPTCHA:', error);
        reject(error);
      }
    });
  });
}

/**
 * Check if reCAPTCHA is configured
 */
export function isRecaptchaConfigured(): boolean {
  return Boolean(
    RECAPTCHA_SITE_KEY && RECAPTCHA_SITE_KEY !== 'your_recaptcha_site_key_here'
  );
}
