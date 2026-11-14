export function html(strings: TemplateStringsArray, ...values: unknown[]): string {
  return strings.join(values.map(String).join(''));
}

export const tags = {
  bold(strings: TemplateStringsArray, ...values: unknown[]): string {
    return `<b>${html(strings, ...values)}</b>`;
  },
};
