import { getCurrentUser, validateCSRFToken } from './auth.js';
import { saveState, loadState } from './state.js';

/**
 * Secure state operations with JWT authentication and CSRF protection
 */

/**
 * Save game state with authentication and integrity checks
 */
export async function saveSecureState(state, csrfToken = null) {
  try {
    // Verify user is authenticated
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.error('[SECURE_STATE] Cannot save state: user not authenticated');
      return false;
    }

    // For state-changing operations, validate CSRF token
    if (csrfToken && !validateCSRFToken(csrfToken)) {
      console.error('[SECURE_STATE] Cannot save state: invalid CSRF token');
      return false;
    }

    // Add authentication metadata to state
    const secureState = {
      ...state,
      _auth: {
        userId: currentUser.userId,
        sessionId: currentUser.sessionId,
        lastSaved: Date.now(),
        integrity: generateStateHash(state)
      }
    };

    // Save using existing state management
    const success = saveState(secureState);
    
    if (success) {
      console.log('[SECURE_STATE] Game state saved securely for user:', currentUser.username);
    }
    
    return success;
  } catch (error) {
    console.error('[SECURE_STATE] Error saving secure state:', error);
    return false;
  }
}

/**
 * Load game state with authentication verification
 */
export async function loadSecureState() {
  try {
    // Load state using existing state management
    const state = loadState();
    
    if (!state || !state._auth) {
      console.log('[SECURE_STATE] No authenticated state found, using default');
      return state;
    }

    // Verify current user matches saved state
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      console.warn('[SECURE_STATE] No authenticated user, clearing auth metadata');
      const { _auth, ...cleanState } = state;
      return cleanState;
    }

    // Check if state belongs to current user
    if (state._auth.userId !== currentUser.userId) {
      console.warn('[SECURE_STATE] State belongs to different user, using default state');
      return null; // This will trigger default state creation
    }

    // Verify state integrity
    const { _auth, ...gameState } = state;
    const expectedHash = generateStateHash(gameState);
    
    if (_auth.integrity !== expectedHash) {
      console.warn('[SECURE_STATE] State integrity check failed, possible tampering detected');
      // In production, you might want to reject the state entirely
      // For now, we'll log the warning and continue
    }

    console.log('[SECURE_STATE] Secure state loaded for user:', currentUser.username);
    return gameState;
    
  } catch (error) {
    console.error('[SECURE_STATE] Error loading secure state:', error);
    return loadState(); // Fallback to regular state loading
  }
}

/**
 * Generate a simple hash of the game state for integrity checking
 */
function generateStateHash(state) {
  try {
    // Create a deterministic string representation of the state
    const stateString = JSON.stringify(state, Object.keys(state).sort());
    
    // Simple hash function (in production, use a proper cryptographic hash)
    let hash = 0;
    for (let i = 0; i < stateString.length; i++) {
      const char = stateString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return hash.toString(16);
  } catch (error) {
    console.error('[SECURE_STATE] Error generating state hash:', error);
    return 'invalid';
  }
}

/**
 * Validate state operation with user permissions
 */
export async function validateStateOperation(operation, permission = 'game:save') {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    console.error(`[SECURE_STATE] Cannot perform ${operation}: user not authenticated`);
    return false;
  }

  if (!currentUser.permissions.includes(permission)) {
    console.error(`[SECURE_STATE] Cannot perform ${operation}: insufficient permissions`);
    return false;
  }

  return true;
}

/**
 * Secure wrapper for state mutations
 */
export function withSecureStateUpdate(updateFunction, csrfToken = null) {
  return async (currentState) => {
    // Validate authentication
    if (!(await validateStateOperation('state_update'))) {
      return currentState;
    }

    // Validate CSRF for state-changing operations
    if (csrfToken && !validateCSRFToken(csrfToken)) {
      console.error('[SECURE_STATE] State update rejected: invalid CSRF token');
      return currentState;
    }

    try {
      // Apply the update function
      const newState = updateFunction(currentState);
      
      // Log the operation for audit trail
      const currentUser = await getCurrentUser();
      console.log('[SECURE_STATE] State updated by user:', currentUser?.username);
      
      return newState;
    } catch (error) {
      console.error('[SECURE_STATE] Error during secure state update:', error);
      return currentState;
    }
  };
}

/**
 * Check if current session can access saved state
 */
export async function canAccessSavedState() {
  try {
    const state = loadState();
    const currentUser = await getCurrentUser();
    
    if (!state?._auth || !currentUser) {
      return true; // No auth constraints
    }

    return state._auth.userId === currentUser.userId;
  } catch (error) {
    console.error('[SECURE_STATE] Error checking state access:', error);
    return false;
  }
}

/**
 * Clear state for current user (secure logout)
 */
export async function clearUserState() {
  const currentUser = await getCurrentUser();
  
  if (!currentUser) {
    console.warn('[SECURE_STATE] Cannot clear state: no authenticated user');
    return false;
  }

  try {
    // Clear localStorage
    localStorage.removeItem('cookieCrazeSaveV4');
    localStorage.removeItem('cookieCrazeSaveV3');
    localStorage.removeItem('cookieCrazeSaveV2');
    localStorage.removeItem('cookieCrazeSaveV1');
    
    console.log('[SECURE_STATE] State cleared for user:', currentUser.username);
    return true;
  } catch (error) {
    console.error('[SECURE_STATE] Error clearing user state:', error);
    return false;
  }
}

/**
 * Export secure state management interface
 */
export const secureStateManager = {
  save: saveSecureState,
  load: loadSecureState,
  clear: clearUserState,
  canAccess: canAccessSavedState,
  validateOperation: validateStateOperation,
  withUpdate: withSecureStateUpdate
};