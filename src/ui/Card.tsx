// A card face, as in the mockup: colour, a large shape behind the value, small corners.
import type { JSX } from 'preact';
import { cardName, getCard, type Colour } from '../rules/cards';
import { ReverseIcon, SkipIcon } from './icons';
import { Quad } from './Logo';

const SHAPE_OF: Record<Colour, JSX.Element> = {
  coral: <circle cx="12" cy="12" r="9" />,
  amber: <path d="M12 3 21.5 20H2.5Z" />,
  teal: <rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />,
  violet: <path d="M12 1.5 22.5 12 12 22.5 1.5 12Z" />,
};

export const Shape = ({ colour, class: cls = '' }: { colour: Colour; class?: string }) => (
  <svg class={cls} viewBox="0 0 24 24" aria-hidden="true" style={{ color: `var(--${colour})`, fill: 'currentColor' }}>
    {SHAPE_OF[colour]}
  </svg>
);

export function Card({ id, class: cls = '' }: { id: number; class?: string }) {
  const card = getCard(id);
  const v = card.value;
  let face: JSX.Element;
  let corner: JSX.Element | string = '';
  if (/^\d$/.test(v)) {
    face = <span class={`num${v === '6' || v === '9' ? ' ul' : ''}`}>{v}</span>;
    corner = v;
  } else if (v === 'skip' || v === 'reverse') {
    const I = v === 'skip' ? SkipIcon : ReverseIcon;
    face = <span class="ico"><I /></span>;
    corner = <span class="mini"><I /></span>;
  } else if (v === 'draw2') {
    face = <span class="num plus">+2</span>;
    corner = '+2';
  } else if (v === 'wild') {
    face = <span class="quad"><Quad /></span>;
  } else {
    face = (
      <>
        <span class="quad small"><Quad /></span>
        <span class="num plus4">+4</span>
      </>
    );
    corner = '+4';
  }
  const colour = card.colour;
  const small = colour ? <svg class="cshape" viewBox="0 0 24 24">{SHAPE_OF[colour]}</svg> : <span class="mini"><Quad /></span>;
  return (
    <div class={`card c-${colour ?? 'wild'} ${cls}`} role="img" aria-label={cardName(card)}>
      {colour && <svg class="mark" viewBox="0 0 24 24">{SHAPE_OF[colour]}</svg>}
      <span class="corner tl">{small}{corner}</span>
      <span class="face">{face}</span>
      <span class="corner br">{small}{corner}</span>
    </div>
  );
}
