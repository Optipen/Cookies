import { useState, useEffect, useRef } from "react";

/**
 * Hook de compte à rebours optimisé
 * @param {number|null} endTimestamp - Timestamp de fin ou null si pas de timer
 * @param {number} throttleMs - Intervalle de mise à jour (défaut: 200ms)
 * @returns {{ remainingMs: number, percentage: number, isActive: boolean, timeText: string }}
 */
export function useCountdown(endTimestamp, throttleMs = 200) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const intervalRef = useRef(null);
  const lastAnnouncementRef = useRef(0);

  // Format du temps en mm:ss
  const formatTime = (ms) => {
    if (ms <= 0) return "00:00";
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Calcul du pourcentage (assume une durée de 30s par défaut si pas de startTime)
  const calculatePercentage = (remaining, endTs) => {
    if (!endTs || remaining <= 0) return 0;
    
    // Essaie de deviner la durée totale basée sur les patterns courants
    // Pour "50_clicks_30s", c'est 30 secondes
    const commonDurations = [30000, 60000, 120000]; // 30s, 1min, 2min
    let totalDuration = 30000; // défaut 30s
    
    // Trouve la durée qui correspond le mieux
    for (const duration of commonDurations) {
      const startTs = endTs - duration;
      if (startTs <= Date.now()) {
        totalDuration = duration;
        break;
      }
    }
    
    const elapsed = totalDuration - remaining;
    return Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  };

  // Annonce accessible (throttled)
  const announceTimeLeft = (remaining) => {
    const now = Date.now();
    const secondsLeft = Math.ceil(remaining / 1000);
    
    // Annonce toutes les 5 secondes pour les 30 dernières secondes
    if (secondsLeft <= 30 && secondsLeft > 0 && (secondsLeft % 5 === 0)) {
      if (now - lastAnnouncementRef.current > 4500) { // Évite les doublons
        lastAnnouncementRef.current = now;
        
        // Utilise aria-live pour annoncer le temps restant
        const announcer = document.getElementById('timer-announcer');
        if (announcer) {
          announcer.textContent = `${secondsLeft} secondes restantes`;
        }
      }
    }
  };

  useEffect(() => {
    // Cleanup fonction
    const cleanup = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    // Si pas de timestamp, désactive le timer
    if (!endTimestamp || endTimestamp <= Date.now()) {
      setRemainingMs(0);
      setIsActive(false);
      cleanup();
      return cleanup;
    }

    // Active le timer
    setIsActive(true);
    
    // Mise à jour immédiate
    const updateRemaining = () => {
      const now = Date.now();
      const remaining = Math.max(0, endTimestamp - now);
      
      setRemainingMs(remaining);
      announceTimeLeft(remaining);
      
      // Arrête le timer si fini
      if (remaining <= 0) {
        setIsActive(false);
        cleanup();
      }
    };

    // Premier update
    updateRemaining();

    // Démarre l'intervalle
    intervalRef.current = setInterval(updateRemaining, throttleMs);

    // Cleanup au démontage
    return cleanup;
  }, [endTimestamp, throttleMs]);

  // Assure le cleanup au démontage du composant
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return {
    remainingMs,
    percentage: calculatePercentage(remainingMs, endTimestamp),
    isActive,
    timeText: formatTime(remainingMs),
    secondsLeft: Math.ceil(remainingMs / 1000)
  };
}

// Le composant TimerAnnouncer est déplacé vers CookieCraze.jsx
// pour éviter le JSX dans un fichier .js
