// The four shapes: coral circle, amber triangle, teal square, violet diamond
export const Quad = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="6.5" cy="6.5" r="4.5" fill="var(--coral)" />
    <path d="M17.5 2 22.5 11H12.5Z" fill="var(--amber)" />
    <rect x="2" y="13" width="9" height="9" rx="1.5" fill="var(--teal)" />
    <path d="M17.5 12.5 22.5 17.5 17.5 22.5 12.5 17.5Z" fill="var(--violet)" />
  </svg>
);

export function Logo({ size = '' }: { size?: '' | 'lg' }) {
  return (
    <span class={`logo ${size}`}>
      <Quad />
    </span>
  );
}
