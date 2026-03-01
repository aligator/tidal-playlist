import { css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { StyledElement } from './styled-element.ts';

const name = 'main-element'

@customElement(name)
export class MainElement extends StyledElement {
  static override localStyles = css`
    .config-grid: {
        display: grid;
        grid-cols-[repeat(auto-fit,minmax(280px,1fr));
    }
    `


  override render() {
    return html`
        <auth-guard>
      <h1>TIDAL Playlist Builder</h1>
      <h2>Build your own playlist - just as you want...</p>

     <section class="config-grid">
        <section>

        </section>
     </section>
        </auth-guard>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    name: MainElement;
  }
}
