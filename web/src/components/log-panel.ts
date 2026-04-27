import { css, html, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { StyledElement } from '../styled-element.ts';

@customElement('log-panel')
export class LogPanel extends StyledElement {
  @state()
  private logText = '';

  @query('textarea')
  private textarea!: HTMLTextAreaElement;

  static override localStyles = css`
    .panel {
      margin-top: 1rem;
      border-radius: 8px;
      border: 1px solid var(--line, #d9dde3);
      background: #fff;
      padding: 0.7rem;
    }
    .title {
      margin: 0 0 0.45rem 0;
      font-size: 0.92rem;
      color: var(--muted, #6b7280);
      font-weight: 600;
    }
    textarea {
      margin: 0;
      border-radius: 8px;
      border: 1px solid var(--line, #d9dde3);
      background: #fafbfc;
      color: var(--text, #1f2937);
      padding: 0.55rem;
      width: 100%;
      resize: vertical;
      min-height: 72px;
    }
  `;

  override render() {
    return html`
      <section class="panel">
        <p class="title">Logs</p>
        <textarea
          rows="5"
          readonly
          placeholder="Logs..."
          .value="${this.logText}"
        ></textarea>
      </section>
    `;
  }

  override updated() {
    if (this.textarea) {
      this.textarea.scrollTop = this.textarea.scrollHeight;
    }
  }

  // ---------- public API ----------

  log(msg: string): void {
    const t = new Date().toLocaleTimeString();
    this.logText += `[${t}] ${msg}\n`;
  }

  clear(): void {
    this.logText = '';
  }
}

// nothing is imported for template consistency with other components
void nothing;

declare global {
  interface HTMLElementTagNameMap {
    'log-panel': LogPanel;
  }
}
