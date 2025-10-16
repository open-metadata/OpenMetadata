/**
 * Safe localStorage helpers for ThirdEye application
 */

const STORAGE_KEYS = {
  AUTH: 'thirdeye-auth-storage',
  THEME: 'thirdeye-theme',
  PREFERENCES: 'thirdeye-preferences'
} as const;

/**
 * Safely get item from localStorage
 */
export function getStorageItem<T>(key: string, defaultValue?: T): T | null {
  if (typeof window === 'undefined') {
    return defaultValue || null;
  }

  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue || null;
    
    return JSON.parse(item);
  } catch (error) {
    console.error(`Error reading from localStorage key "${key}":`, error);
    return defaultValue || null;
  }
}

/**
 * Safely set item in localStorage
 */
export function setStorageItem<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error writing to localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Safely remove item from localStorage
 */
export function removeStorageItem(key: string): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error(`Error removing from localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Clear all ThirdEye-related localStorage items
 */
export function clearAllStorage(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    return true;
  } catch (error) {
    console.error('Error clearing localStorage:', error);
    return false;
  }
}

/**
 * Check if localStorage is available
 */
export function isStorageAvailable(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    const testKey = '__localStorage_test__';
    localStorage.setItem(testKey, 'test');
    localStorage.removeItem(testKey);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get storage usage information
 */
export function getStorageInfo(): { used: number; available: number; total: number } {
  if (typeof window === 'undefined') {
    return { used: 0, available: 0, total: 0 };
  }

  try {
    let used = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length + key.length;
      }
    }

    // Most browsers have a 5-10MB limit
    const total = 5 * 1024 * 1024; // 5MB
    const available = total - used;

    return { used, available, total };
  } catch (error) {
    console.error('Error getting storage info:', error);
    return { used: 0, available: 0, total: 0 };
  }
}

/**
 * Storage event listener for cross-tab synchronization
 */
export function setupStorageSync(callback: (key: string, newValue: any, oldValue: any) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleStorageChange = (event: StorageEvent) => {
    if (event.key && Object.values(STORAGE_KEYS).includes(event.key as any)) {
      try {
        const newValue = event.newValue ? JSON.parse(event.newValue) : null;
        const oldValue = event.oldValue ? JSON.parse(event.oldValue) : null;
        callback(event.key, newValue, oldValue);
      } catch (error) {
        console.error('Error parsing storage change:', error);
      }
    }
  };

  window.addEventListener('storage', handleStorageChange);
  
  return () => {
    window.removeEventListener('storage', handleStorageChange);
  };
}

export { STORAGE_KEYS };
