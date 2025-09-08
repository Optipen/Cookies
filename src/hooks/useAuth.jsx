import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  isAuthenticated,
  getCurrentUser,
  createUserSession,
  refreshAccessToken,
  logout,
  getAuthTokens,
  generateCSRFToken,
  validateCSRFToken
} from '../utils/auth.js';

const AuthContext = createContext(null);

/**
 * Authentication Provider Component
 * Manages authentication state and provides auth methods to the app
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  /**
   * Initialize authentication state on app load
   */
  const initializeAuth = useCallback(async () => {
    setIsLoading(true);
    setAuthError(null);

    try {
      const authStatus = await isAuthenticated();
      
      if (authStatus === true) {
        // Valid access token exists
        const currentUser = await getCurrentUser();
        setUser(currentUser);
        console.log('[AUTH] User authenticated:', currentUser?.username);
      } else if (authStatus === 'refresh_needed') {
        // Try to refresh access token
        try {
          await refreshAccessToken();
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          console.log('[AUTH] Token refreshed, user authenticated:', currentUser?.username);
        } catch (error) {
          console.error('[AUTH] Token refresh failed:', error);
          await handleLogout();
        }
      } else {
        // No valid authentication
        setUser(null);
        console.log('[AUTH] No valid authentication found');
      }
    } catch (error) {
      console.error('[AUTH] Authentication initialization failed:', error);
      setAuthError(error.message);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Login user with credentials or create anonymous session
   */
  const login = useCallback(async (credentials = null) => {
    setIsLoading(true);
    setAuthError(null);

    try {
      let userData;
      
      if (credentials) {
        // In a real app, this would validate against a backend
        userData = {
          username: credentials.username,
          permissions: ['game:play', 'game:save', 'achievements:unlock']
        };
      } else {
        // Create anonymous session for the game
        userData = {
          username: `Anonymous_${Date.now()}`,
          permissions: ['game:play', 'game:save']
        };
      }

      const session = await createUserSession(userData);
      setUser(session.user);
      
      console.log('[AUTH] User logged in:', session.user.username);
      return session;
    } catch (error) {
      console.error('[AUTH] Login failed:', error);
      setAuthError(error.message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Logout user and clear authentication
   */
  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    
    try {
      logout();
      setUser(null);
      setAuthError(null);
      console.log('[AUTH] User logged out');
    } catch (error) {
      console.error('[AUTH] Logout error:', error);
      setAuthError(error.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check if user has specific permission
   */
  const hasPermission = useCallback((permission) => {
    return user?.permissions?.includes(permission) ?? false;
  }, [user]);

  /**
   * Get CSRF token for secure operations
   */
  const getCSRFToken = useCallback(() => {
    const { csrfToken } = getAuthTokens();
    return csrfToken || generateCSRFToken();
  }, []);

  /**
   * Validate CSRF token for state-changing operations
   */
  const validateCSRF = useCallback((token) => {
    return validateCSRFToken(token);
  }, []);

  /**
   * Refresh authentication tokens
   */
  const refreshAuth = useCallback(async () => {
    try {
      await refreshAccessToken();
      const currentUser = getCurrentUser();
      setUser(currentUser);
      return true;
    } catch (error) {
      console.error('[AUTH] Token refresh failed:', error);
      await handleLogout();
      return false;
    }
  }, [handleLogout]);

  /**
   * Auto-refresh tokens before expiration
   */
  useEffect(() => {
    if (!user) return;

    const refreshInterval = setInterval(async () => {
      const authStatus = await isAuthenticated();
      
      if (authStatus === 'refresh_needed') {
        console.log('[AUTH] Auto-refreshing tokens...');
        await refreshAuth();
      } else if (authStatus === false) {
        console.log('[AUTH] Authentication expired, logging out...');
        await handleLogout();
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(refreshInterval);
  }, [user, refreshAuth, handleLogout]);

  /**
   * Initialize authentication on mount
   */
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  /**
   * Handle visibility change to check auth status when tab becomes active
   */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!document.hidden && user) {
        const authStatus = await isAuthenticated();
        if (authStatus === false) {
          console.log('[AUTH] Authentication expired while tab was hidden');
          handleLogout();
        } else if (authStatus === 'refresh_needed') {
          console.log('[AUTH] Refreshing authentication after tab focus');
          refreshAuth();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [user, handleLogout, refreshAuth]);

  const value = {
    // State
    user,
    isLoading,
    isAuthenticated: !!user,
    authError,
    
    // Methods
    login,
    logout: handleLogout,
    hasPermission,
    getCSRFToken,
    validateCSRF,
    refreshAuth,
    initializeAuth
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to use authentication context
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  return context;
}

/**
 * HOC to require authentication for components
 */
export function withAuth(Component) {
  return function AuthenticatedComponent(props) {
    const { isAuthenticated, isLoading, login } = useAuth();
    
    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        // Auto-login with anonymous session for the game
        login();
      }
    }, [isAuthenticated, isLoading, login]);
    
    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto mb-4"></div>
            <p className="text-amber-200">Initializing secure session...</p>
          </div>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p className="text-amber-200 mb-4">Authentication required</p>
            <button 
              onClick={() => login()}
              className="px-4 py-2 bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors"
            >
              Start Game Session
            </button>
          </div>
        </div>
      );
    }
    
    return <Component {...props} />;
  };
}

/**
 * Hook for components that need CSRF protection
 */
export function useCSRF() {
  const { getCSRFToken, validateCSRF } = useAuth();
  
  return {
    getToken: getCSRFToken,
    validate: validateCSRF
  };
}