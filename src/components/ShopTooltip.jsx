import React, { useState, useRef, useEffect } from "react";

/**
 * Tooltip générique réutilisable pour les cartes de shop
 * @param {Object} props
 * @param {string} props.title - Titre du tooltip
 * @param {Array} props.lines - Lignes de contenu [{ label, value, className }]
 * @param {string} props.side - Position: "top"|"bottom"|"left"|"right"
 * @param {number} props.delay - Délai avant apparition (ms)
 * @param {React.ReactNode} props.children - Élément déclencheur
 * @param {string} props.className - Classes CSS additionnelles
 */
export default function ShopTooltip({ 
  title, 
  lines = [], 
  side = "top", 
  delay = 300,
  children,
  className = ""
}) {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const timeoutRef = useRef(null);
  const tooltipRef = useRef(null);
  const triggerRef = useRef(null);

  // Affiche le tooltip après le délai
  const showTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  // Cache le tooltip immédiatement
  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  // Gestion des événements
  const handleMouseEnter = () => {
    setIsHovered(true);
    showTooltip();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (!isFocused) {
      hideTooltip();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    showTooltip();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!isHovered) {
      hideTooltip();
    }
  };

  // Gestion clavier (Escape pour fermer)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isVisible) {
        hideTooltip();
        if (triggerRef.current) {
          triggerRef.current.focus();
        }
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible]);

  // Cleanup timeout
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Classes de positionnement du tooltip
  const getPositionClasses = () => {
    const baseClasses = "absolute z-50 px-3 py-2 text-xs bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-xl backdrop-blur-sm";
    
    switch (side) {
      case "top":
        return `${baseClasses} bottom-full left-1/2 -translate-x-1/2 mb-2`;
      case "bottom":
        return `${baseClasses} top-full left-1/2 -translate-x-1/2 mt-2`;
      case "left":
        return `${baseClasses} right-full top-1/2 -translate-y-1/2 mr-2`;
      case "right":
        return `${baseClasses} left-full top-1/2 -translate-y-1/2 ml-2`;
      default:
        return `${baseClasses} bottom-full left-1/2 -translate-x-1/2 mb-2`;
    }
  };

  // ID unique pour l'accessibilité
  const tooltipId = `tooltip-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <div className={`relative ${className}`}>
      {/* Élément déclencheur */}
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        aria-describedby={isVisible ? tooltipId : undefined}
        tabIndex={0}
        className="focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-opacity-50 rounded"
      >
        {children}
      </div>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={getPositionClasses()}
          style={{ minWidth: '200px', maxWidth: '320px' }}
        >
          {/* Titre */}
          {title && (
            <div className="font-semibold text-zinc-100 mb-2 border-b border-zinc-700 pb-1">
              {title}
            </div>
          )}

          {/* Contenu */}
          <div className="space-y-1">
            {lines.map((line, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-zinc-300">{line.label}:</span>
                <span className={`font-mono ${line.className || 'text-zinc-100'}`}>
                  {line.value}
                </span>
              </div>
            ))}
          </div>

          {/* Flèche du tooltip */}
          <div
            className={`absolute w-2 h-2 bg-zinc-900 border-zinc-700 rotate-45 ${
              side === "top" 
                ? "top-full left-1/2 -translate-x-1/2 -mt-1 border-r border-b"
                : side === "bottom"
                ? "bottom-full left-1/2 -translate-x-1/2 -mb-1 border-l border-t"
                : side === "left"
                ? "left-full top-1/2 -translate-y-1/2 -ml-1 border-t border-r"
                : "right-full top-1/2 -translate-y-1/2 -mr-1 border-b border-l"
            }`}
          />
        </div>
      )}
    </div>
  );
}
