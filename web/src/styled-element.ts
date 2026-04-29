import { type CSSResultGroup, LitElement, unsafeCSS } from 'lit';
// @ts-expect-error Deno LSP doesn't know ?inline vite does...
import globalStyles from './index.css?inline';

export abstract class StyledElement extends LitElement {
  static globalStyles = unsafeCSS(globalStyles);
  static localStyles?: CSSResultGroup;

  static override get styles() {
    return [
      this.globalStyles,
      this.localStyles ?? [],
    ];
  }
}
