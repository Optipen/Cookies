import React from "react";

export default function Tooltip({ children, panel, className = "", panelClassName = "", position = "right" }) {
  const posCls = position === "right"
    ? "left-full ml-2 top-1/2 -translate-y-1/2"
    : position === "top"
    ? "bottom-full mb-2 left-1/2 -translate-x-1/2"
    : position === "bottom"
    ? "top-full mt-2 left-1/2 -translate-x-1/2"
    : "right-full mr-2 top-1/2 -translate-y-1/2";

  return (
    <div className={`relative group outline-none ${className}`} tabIndex={0}>
      {children}
      <div className={`pointer-events-none absolute z-50 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition duration-150 ${posCls}`}>
        <div className={`rounded-xl px-3 py-2 text-xs bg-zinc-900/90 border border-zinc-700 shadow-xl backdrop-blur ${panelClassName}`}>
          {panel}
        </div>
      </div>
    </div>
  );
}


