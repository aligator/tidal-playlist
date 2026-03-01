import { ShadowComponent } from './shadow-component.ts';

export class LogPanel extends ShadowComponent {
  private $log!: HTMLTextAreaElement;

  connectedCallback(): void {
    this.renderShadow(
      `
      <section class="panel">
        <p class="title">Logs</p>
        <textarea id="log" rows="5" readonly placeholder="Logs..."></textarea>
      </section>
    `,
      `
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
        #log {
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
      `,
    );
    this.$log = this.requireElement<HTMLTextAreaElement>('#log');
  }

  log(msg: string): void {
    const t = new Date().toLocaleTimeString();
    this.$log.value += `[${t}] ${msg}\n`;
    this.$log.scrollTop = this.$log.scrollHeight;
  }

  clear(): void {
    this.$log.value = '';
  }
}

customElements.define('log-panel', LogPanel);
