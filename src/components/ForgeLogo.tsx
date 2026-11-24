import React from 'react';

export function ForgeLogo({ size = 34, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Logo SiteForge"
      >
        <defs>
          <linearGradient id="forgeEmber" x1="8" y1="6" x2="40" y2="42" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F97316" />
            <stop offset="55%" stopColor="#DC2626" />
            <stop offset="100%" stopColor="#7C2D12" />
          </linearGradient>
          <linearGradient id="steelBlade" x1="14" y1="8" x2="36" y2="26" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F8FAFC" />
            <stop offset="50%" stopColor="#CBD5E1" />
            <stop offset="100%" stopColor="#F59E0B" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="44" height="44" rx="11" fill="#18181B" stroke="#3F3F46" strokeWidth="1.5" />
        {/* Étincelles de forge */}
        <circle cx="15" cy="11" r="1.6" fill="#FBBF24" />
        <circle cx="35" cy="10" r="1.4" fill="#FB923C" />
        <circle cx="38" cy="17" r="1.2" fill="#FDE047" />
        {/* Lame d'épée en cours de forge sur l'enclume */}
        <path d="M13 24L33 12L37 14L16 26.5L13 24Z" fill="url(#steelBlade)" />
        <path d="M11 23L15.5 27.5" stroke="#D97706" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M8.5 28L12.5 25.5" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" />
        {/* Enclume de forgeron */}
        <path
          d="M11 28H35C38.5 28 41 29.8 41 31.5C41 32.8 38.5 34 35 34H32L34 40H15L17 34H13L9 31.5C9 29.5 9.8 28 11 28Z"
          fill="url(#forgeEmber)"
        />
        <rect x="13" y="39" width="23" height="3" rx="1.5" fill="#52525B" />
      </svg>
      {showText && (
        <span className="font-bold tracking-tight text-lg">
          Site<span className="text-orange-500">Forge</span>
        </span>
      )}
    </span>
  );
}
