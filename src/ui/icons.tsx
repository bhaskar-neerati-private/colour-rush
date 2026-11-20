// Line icons from the mockup.
import type { ComponentChildren } from 'preact';

function Icon({ children, width = 2 }: { children: ComponentChildren; width?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width={width} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const InfoIcon = () => <Icon><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.01" /></Icon>;
export const CloseIcon = () => <Icon width={2.2}><path d="M6 6l12 12M18 6 6 18" /></Icon>;
export const CopyIcon = () => <Icon><rect x="8" y="8" width="12" height="12" rx="2" /><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" /></Icon>;
export const ShareIcon = () => <Icon><path d="M12 15V3M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></Icon>;
export const WifiOffIcon = () => <Icon width={2.2}><path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19v.01M3 3l18 18" /></Icon>;
export const SkipIcon = () => <Icon width={2.6}><circle cx="12" cy="12" r="8.5" /><path d="M6.2 17.8 17.8 6.2" /></Icon>;
export const ReverseIcon = () => <Icon width={2.4}><path d="M4 9h14l-3.5-3.5" /><path d="M20 15H6l3.5 3.5" /></Icon>;
