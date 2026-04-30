import { css, svg } from 'lit';

export const logoColors = css`
  --logo-bg: light-dark(#c3e8ff, #004c68);
  --logo-lines: light-dark(#006689, #7ad0ff);
  --logo-heart: light-dark(#ba1a1a, #ffb4ab);
`;

export function appLogo(size = 32) {
  return svg`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">
      <rect x="24" y="24" width="208" height="208" rx="48" style="fill: var(--logo-bg)" />
      <rect x="64" y="76" width="128" height="20" rx="10" style="fill: var(--logo-lines)" />
      <rect x="64" y="112" width="96" height="20" rx="10" style="fill: var(--logo-lines)" />
      <rect x="64" y="148" width="112" height="20" rx="10" style="fill: var(--logo-lines)" />
      <path
        d="M152 118c0-14 18-20 28-8 10-12 28-6 28 8
               0 18-28 34-28 34s-28-16-28-34z"
        style="fill: var(--logo-heart)"
      />
    </svg>
  `;
}
