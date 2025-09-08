import React, { useEffect } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';

/**
 * Security middleware component that handles various security concerns
 */
export function SecurityMiddleware({ children }) {
  const { user, authError } = useAuth();

  useEffect(() => {
    // Disable right-click context menu in production
    if (import.meta.env.PROD) {
      const handleContextMenu = (e) => {
        e.preventDefault();
        return false;
      };

      // Disable common developer shortcuts in production
      const handleKeyDown = (e) => {
        // Disable F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+U
        if (
          e.key === 'F12' ||
          (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'J')) ||
          (e.ctrlKey && e.key === 'u')
        ) {
          e.preventDefault();
          return false;
        }
      };

      document.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('keydown', handleKeyDown);

      return () => {
        document.removeEventListener('contextmenu', handleContextMenu);
        document.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, []);

  // Clear console in production
  useEffect(() => {
    if (import.meta.env.PROD && import.meta.env.VITE_AUTH_DEBUG !== 'true') {
      console.clear();
      
      // Override console methods in production
      const noop = () => {};
      Object.assign(console, {
        log: noop,
        warn: noop,
        error: noop,
        info: noop,
        debug: noop
      });
    }
  }, []);

  // Monitor for authentication errors
  useEffect(() => {
    if (authError) {
      console.error('[SECURITY] Authentication error detected:', authError);
      
      // In production, you might want to redirect to an error page
      // or take other security measures
    }
  }, [authError]);

  // Anti-tampering: Basic check for common injection attempts
  useEffect(() => {
    const checkForTampering = () => {
      // Check for common XSS attempts in URL
      const url = window.location.href;
      const suspiciousPatterns = [
        /<script/i,
        /javascript:/i,
        /data:text\/html/i,
        /vbscript:/i,
        /onload=/i,
        /onerror=/i
      ];

      if (suspiciousPatterns.some(pattern => pattern.test(url))) {
        console.error('[SECURITY] Potential XSS attempt detected in URL');
        window.location.href = '/';
        return;
      }

      // Check for modified localStorage keys
      try {
        const keys = Object.keys(localStorage);
        const suspiciousKeys = keys.filter(key => 
          key.includes('script') || 
          key.includes('eval') || 
          key.includes('function')
        );

        if (suspiciousKeys.length > 0) {
          console.error('[SECURITY] Suspicious localStorage keys detected:', suspiciousKeys);
          // Clear potentially malicious keys
          suspiciousKeys.forEach(key => localStorage.removeItem(key));
        }
      } catch (error) {
        console.error('[SECURITY] Error checking localStorage:', error);
      }
    };

    checkForTampering();

    // Periodic security checks
    const securityInterval = setInterval(checkForTampering, 30000); // Every 30 seconds

    return () => clearInterval(securityInterval);
  }, []);

  // Add security headers via meta tags as fallback
  useEffect(() => {
    const addSecurityMeta = () => {
      const head = document.head;

      // Content Security Policy
      if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
        const cspMeta = document.createElement('meta');
        cspMeta.httpEquiv = 'Content-Security-Policy';
        cspMeta.content = "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self';";
        head.appendChild(cspMeta);
      }

      // X-Content-Type-Options
      if (!document.querySelector('meta[http-equiv="X-Content-Type-Options"]')) {
        const noSniffMeta = document.createElement('meta');
        noSniffMeta.httpEquiv = 'X-Content-Type-Options';
        noSniffMeta.content = 'nosniff';
        head.appendChild(noSniffMeta);
      }
    };

    addSecurityMeta();
  }, []);

  return (
    <>
      {children}
      {/* Security indicator for development */}
      {import.meta.env.DEV && (
        <div className="fixed bottom-2 right-2 z-50 text-xs bg-green-600 text-white px-2 py-1 rounded">
          🔒 Secure {user ? `(${user.username})` : '(Anonymous)'}
        </div>
      )}
    </>
  );
}

/**
 * Component to display security warnings
 */
export function SecurityWarning({ message, onDismiss }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75">
      <div className="bg-red-600 text-white p-6 rounded-lg max-w-md mx-4">
        <div className="flex items-center mb-4">
          <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <h3 className="text-lg font-semibold">Security Warning</h3>
        </div>
        <p className="mb-4">{message}</p>
        <button 
          onClick={onDismiss}
          className="w-full bg-white text-red-600 py-2 px-4 rounded hover:bg-gray-100 transition-colors"
        >
          I Understand
        </button>
      </div>
    </div>
  );
}