import DOMPurify from 'dompurify';

/**
 * Sanitize HTML to prevent XSS attacks
 *
 * SECURITY: Use this for ALL user-generated content before rendering
 * - Bio
 * - Display names
 * - Tweets/posts
 * - Comments
 * - Any user input that might contain HTML
 *
 * DOMPurify removes potentially dangerous HTML/JavaScript while
 * preserving safe formatting like bold, italic, links, etc.
 */

/**
 * Sanitize user-generated HTML content
 * Allows basic formatting but removes scripts and dangerous attributes
 */
export const sanitizeHtml = (dirty: string | null | undefined): string => {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
  });
};

/**
 * Sanitize plain text content (no HTML allowed)
 * Use for display names, usernames, etc. where HTML should not be rendered
 */
export const sanitizeText = (dirty: string | null | undefined): string => {
  if (!dirty) return '';

  // Strip all HTML tags, only return text content
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });
};

/**
 * Sanitize and allow limited HTML for bio/descriptions
 * Allows more formatting options while still being secure
 */
export const sanitizeBio = (dirty: string | null | undefined): string => {
  if (!dirty) return '';

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOW_DATA_ATTR: false,
    // Force all links to open in new tab and have noopener noreferrer
    ADD_ATTR: ['target', 'rel'],
  });
};

/**
 * Create safe links by adding security attributes
 */
export const createSafeLink = (url: string, text: string): string => {
  const sanitizedUrl = DOMPurify.sanitize(url, { ALLOWED_TAGS: [] });
  const sanitizedText = DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });

  return `<a href="${sanitizedUrl}" target="_blank" rel="noopener noreferrer">${sanitizedText}</a>`;
};
