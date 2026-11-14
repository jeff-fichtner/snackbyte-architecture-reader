import { html, tags } from './html.js';

function escape(text: string): string {
  return text.replace(/</g, '&lt;');
}

export function render(name: string): string {
  return html`<p>${escape(name)}</p>`;
}

export function raw(name: string): string {
  return String.raw`<p>${name}</p>`;
}

export function nested(name: string): string {
  return html`<div>${tags.bold`${escape(name)}`}</div>`;
}
