const BASE_SHADOW_CSS = `
  :host {
    color: var(--text, #1f2937);
  }
  button,
  input,
  select,
  textarea {
    font: inherit;
  }
  button {
    border: 1px solid var(--line, #d9dde3);
    border-radius: 6px;
    background: #fff;
    color: var(--text, #1f2937);
  }
  input,
  select,
  textarea {
    border: 1px solid var(--line, #d9dde3);
    border-radius: 6px;
    background: #fff;
    color: var(--text, #1f2937);
  }
  input:focus,
  select:focus,
  textarea:focus,
  button:focus-visible {
    outline: 2px solid var(--focus, #2563eb);
    outline-offset: 1px;
  }
`;

export abstract class ShadowComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  protected get root(): ShadowRoot {
    if (!this.shadowRoot) {
      throw new Error('Shadow root not initialized.');
    }
    return this.shadowRoot;
  }

  protected requireElement<T extends Element>(selector: string): T {
    const element = this.root.querySelector(selector);
    if (!(element instanceof Element)) {
      throw new Error(`Missing required element: ${selector}`);
    }
    return element as T;
  }

  protected renderShadow(html: string, css = ''): void {
    this.root.innerHTML = `
      <style>
        ${BASE_SHADOW_CSS}
        ${css}
      </style>
      ${html}
    `;
  }
}
