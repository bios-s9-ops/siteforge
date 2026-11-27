interface ForgeLogoProps {
  size?: number;
  /** Couleur des braises */
  ember?: string;
  className?: string;
  /** Texte alternatif ; vide = décoratif */
  title?: string;
}

/**
 * Emblème de SiteForge : enclume de forgeron, lame d'épée forgée, marteau et braises.
 * Formes géométriques pleines, une seule couleur (currentColor) plus l'accent des braises.
 */
export function ForgeLogo({ size = 32, ember = '#C2410C', className, title }: ForgeLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title || undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M5 40.5 L14 38.5 H52 V44.5 H45 L41 49 V53 H47 V58 H17 V53 H23 V49 L19 44.5 H13 Z" />
        <path d="M32 3 L35.6 9 V29.5 H28.4 V9 Z" />
        <rect x="22.5" y="29.5" width="19" height="3.4" rx="0.6" />
        <rect x="30.4" y="32.9" width="3.2" height="5.6" />
        <g transform="rotate(26 51 16)">
          <rect x="43" y="7" width="15" height="8.4" rx="1" />
          <rect x="49.3" y="15.4" width="3.4" height="17" />
        </g>
      </g>
      <rect x="31.5" y="11.5" width="1" height="16.5" style={{ fill: 'var(--forge-blade-line, #FBF8F3)' }} />
      <g fill={ember}>
        <rect x="37.6" y="19.2" width="2.8" height="2.8" transform="rotate(45 39 20.6)" />
        <rect x="41.8" y="26" width="2.2" height="2.2" transform="rotate(45 42.9 27.1)" />
        <rect x="22.4" y="21.6" width="2.2" height="2.2" transform="rotate(45 23.5 22.7)" />
        <rect x="19" y="14.4" width="1.8" height="1.8" transform="rotate(45 19.9 15.3)" />
      </g>
    </svg>
  );
}
