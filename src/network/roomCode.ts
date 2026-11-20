// Room codes: 4 characters, without look-alikes (no 0, O, 1 or I).

import { randomInt } from '../shuffle/group';

export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 4;

export function randomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}

/** Cleans what a player typed: upper case, no spaces. */
export const normaliseCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, '');

export const isValidCode = (code: string) =>
  code.length === CODE_LENGTH && [...code].every((ch) => CODE_ALPHABET.includes(ch));

/** The invite link for a room, for example https://.../colour-rush/#QM7K */
export const inviteLink = (code: string, base = `${location.origin}${location.pathname}`) => `${base}#${code}`;

/** The room code in a link's hash, if there is a valid one. */
export function codeFromHash(hash: string): string | null {
  const code = normaliseCode(hash.replace(/^#/, ''));
  return isValidCode(code) ? code : null;
}
