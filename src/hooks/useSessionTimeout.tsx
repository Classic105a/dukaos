import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';

const TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_MS = 60 * 1000; // 1 minute warning before timeout
const LOCK_CHANNEL = 'dukaos_session_lock';

interface UseSessionTimeoutReturn {
  isLocked: boolean;
  showWarning: boolean;
  timeUntilLock: number;
  unlock: (pin?: string) => boolean;
  lock: () => void;
  resetTimer: () => void;
  setPin: (pin: string) => void;
  hasPin: boolean;
}

export const useSessionTimeout = (): UseSessionTimeoutReturn => {
  const { user } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [timeUntilLock, setTimeUntilLock] = useState(TIMEOUT_MS);
  const [pin, setPinState] = useState<string | null>(() => {
    return localStorage.getItem('session_pin');
  });
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const lastActivityRef = useRef(Date.now());
  const channelRef = useRef<BroadcastChannel | null>(null);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const lock = useCallback(() => {
    setIsLocked(true);
    setShowWarning(false);
    clearTimers();
    try { channelRef.current?.postMessage({ type: 'lock' }); } catch { /* noop */ }
  }, [clearTimers]);

  const resetTimer = useCallback(() => {
    if (!user || isLocked) return;
    // H6: skip timer arming while tab is hidden — resumes on visibility change
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      clearTimers();
      return;
    }
    
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setTimeUntilLock(TIMEOUT_MS);
    clearTimers();

    // Set warning timer
    warningRef.current = setTimeout(() => {
      setShowWarning(true);
      setTimeUntilLock(WARNING_MS);
      
      // Start countdown
      countdownRef.current = setInterval(() => {
        setTimeUntilLock(prev => {
          if (prev <= 1000) {
            lock();
            return 0;
          }
          return prev - 1000;
        });
      }, 1000);
    }, TIMEOUT_MS - WARNING_MS);

    // Set lock timer
    timeoutRef.current = setTimeout(lock, TIMEOUT_MS);
  }, [user, isLocked, lock, clearTimers]);

  const unlock = useCallback((enteredPin?: string) => {
    if (pin) {
      if (enteredPin === pin) {
        setIsLocked(false);
        resetTimer();
        try { channelRef.current?.postMessage({ type: 'unlock' }); } catch { /* noop */ }
        return true;
      }
      return false;
    }
    setIsLocked(false);
    resetTimer();
    try { channelRef.current?.postMessage({ type: 'unlock' }); } catch { /* noop */ }
    return true;
  }, [pin, resetTimer]);

  const setPin = useCallback((newPin: string) => {
    setPinState(newPin);
    localStorage.setItem('session_pin', newPin);
  }, []);

  // Listen for user activity
  useEffect(() => {
    if (!user) return;

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleActivity = () => {
      if (!isLocked) {
        resetTimer();
      }
    };

    events.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // H6: pause/resume on tab visibility to save battery
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !isLocked) resetTimer();
      else clearTimers();
    };
    document.addEventListener('visibilitychange', onVisibility);

    // M10: cross-tab lock/unlock sync
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(LOCK_CHANNEL);
      channelRef.current = channel;
      channel.onmessage = (ev) => {
        if (ev.data?.type === 'lock') { setIsLocked(true); setShowWarning(false); clearTimers(); }
        if (ev.data?.type === 'unlock') { setIsLocked(false); }
      };
    }

    resetTimer();

    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      document.removeEventListener('visibilitychange', onVisibility);
      channel?.close();
      channelRef.current = null;
      clearTimers();
    };
  }, [user, isLocked, resetTimer, clearTimers]);

  // Reset when user changes
  useEffect(() => {
    if (user) {
      setIsLocked(false);
      resetTimer();
    } else {
      clearTimers();
    }
    // Intentionally keyed on `user` only: resetTimer/clearTimers are stable
    // callbacks and re-running this on their identity would re-unlock the screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  return {
    isLocked,
    showWarning,
    timeUntilLock,
    unlock,
    lock,
    resetTimer,
    setPin,
    hasPin: !!pin,
  };
};
