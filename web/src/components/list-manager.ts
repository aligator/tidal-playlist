import type { ItemMeta, ItemMetaMap, LookupProvider, LookupResult } from '../types.ts';
import { ShadowComponent } from './shadow-component.ts';

function escapeHtml(value: string): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function parseListField(value: string): string[] {
  return String(value)
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function uniqueList(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = String(value).trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

export class ListManager extends ShadowComponent {
  private items: string[] = [];
  private itemMeta = new Map<string, ItemMeta>();
  private lookupProvider: LookupProvider | null = null;
  private lookupResults: LookupResult[] = [];
  private lookupError = '';
  private lookupLoading = false;
  private lookupRequestId = 0;
  private lookupTimer: number | null = null;
  private hideTimer: number | null = null;

  connectedCallback(): void {
    this.render();
    this.bind();
    this.renderItems();
    this.renderLookupResults();
  }

  disconnectedCallback(): void {
    if (this.lookupTimer !== null) {
      clearTimeout(this.lookupTimer);
    }
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
    }
  }

  private render(): void {
    const title = this.getAttribute('title') ?? 'List';
    const lookupPlaceholder = this.getAttribute('lookup-placeholder') ?? 'Search in TIDAL';

    this.renderShadow(
      `      <div class="list-manager">
        <div class="list-manager-head">
          <strong>${escapeHtml(title)}</strong>
          <span class="list-count"></span>
        </div>

        <div class="lookup-block">
          <div class="lookup-row">
            <input class="lookup-input" placeholder="${
      escapeHtml(lookupPlaceholder)
    }" autocomplete="off" />
          </div>
          <div class="lookup-status"></div>
          <div class="lookup-dropdown"></div>
        </div>
        <div class="list-items"></div>
      </div>
    `,
      `        :host {
          display: block;
        }
        .list-manager {
          border: 1px solid var(--line, #d9dde3);
          border-radius: 8px;
          padding: 0.6rem;
          background: var(--panel, #fff);
        }
        .list-manager-head {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          align-items: baseline;
          margin-bottom: 0.45rem;
        }
        .list-count {
          color: var(--muted, #6b7280);
          font-size: 0.84rem;
        }
        .lookup-block {
          margin-bottom: 0.55rem;
          position: relative;
        }
        .lookup-status {
          margin-top: 0.35rem;
          color: var(--muted, #6b7280);
          font-size: 0.84rem;
        }
        .lookup-dropdown {
          display: none;
          position: absolute;
          top: calc(100% + 0.3rem);
          left: 0;
          right: 0;
          z-index: 30;
          max-height: 190px;
          overflow: auto;
          border: 1px solid var(--line, #d9dde3);
          border-radius: 8px;
          background: var(--panel, #fff);
          box-shadow: 0 6px 18px rgb(0 0 0 / 12%);
          padding: 0.25rem;
        }
        .lookup-dropdown:not(:empty) {
          display: block;
        }
        .lookup-info {
          margin: 0.1rem 0;
          padding: 0.45rem 0.5rem;
          color: var(--muted, #6b7280);
          border-radius: 6px;
          background: #f2f4f7;
          font-size: 0.84rem;
        }
        .lookup-option {
          width: 100%;
          text-align: left;
          display: grid;
          gap: 0.1rem;
          border: 0;
          border-radius: 6px;
          padding: 0.45rem 0.5rem;
          background: transparent;
          margin: 0.1rem 0;
          font: inherit;
          color: inherit;
          cursor: pointer;
        }
        .lookup-option:hover {
          background: #eef2f7;
        }
        .lookup-option code,
        .lookup-option small {
          color: var(--muted, #6b7280);
        }
        .lookup-option-main {
          font-weight: 600;
        }
        .list-items {
          margin-top: 0.5rem;
          max-height: 180px;
          overflow: auto;
          display: grid;
          gap: 0.35rem;
        }
        .list-item {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          align-items: center;
          border: 1px solid var(--line, #d9dde3);
          border-radius: 6px;
          padding: 0.35rem 0.45rem;
          background: #fafbfc;
        }
        .list-item code {
          overflow-wrap: anywhere;
          color: var(--muted, #6b7280);
        }
        .list-item-text {
          display: grid;
          gap: 0.12rem;
        }
        .list-item-text small {
          color: var(--muted, #6b7280);
        }
        .list-remove-btn {
          min-width: 1.9rem;
          padding: 0.2rem 0.45rem;
          line-height: 1;
        }
        .list-empty {
          margin: 0;
          color: var(--muted, #6b7280);
        }
        input {
          width: 100%;
          padding: 0.5rem 0.6rem;
        }
`,
    );
  }

  private bind(): void {
    const lookupInput = this.requireElement<HTMLInputElement>('.lookup-input');
    const lookupDropdown = this.requireElement<HTMLElement>('.lookup-dropdown');

    lookupInput.addEventListener('input', () => {
      const query = lookupInput.value.trim();
      if (!this.lookupProvider || query.length < 2) {
        this.lookupResults = [];
        this.lookupError = '';
        this.lookupLoading = false;
        this.renderLookupResults();
        return;
      }

      if (this.lookupTimer !== null) {
        clearTimeout(this.lookupTimer);
      }
      this.lookupTimer = globalThis.setTimeout(() => {
        void this.runLookup(query);
      }, 220);
    });

    lookupInput.addEventListener('focus', () => {
      if (this.hideTimer !== null) {
        clearTimeout(this.hideTimer);
      }
      this.renderLookupResults();
    });

    lookupInput.addEventListener('blur', () => {
      this.hideTimer = globalThis.setTimeout(() => {
        this.lookupResults = [];
        this.lookupLoading = false;
        this.lookupError = '';
        this.renderLookupResults();
      }, 120);
    });

    lookupInput.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const first = this.lookupResults[0];
        if (first?.id) {
          this.addResultId(first.id);
        }
      }
    });

    lookupDropdown.addEventListener('pointerdown', (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const option = target.closest('.lookup-option');
      if (!(option instanceof HTMLElement)) {
        return;
      }
      event.preventDefault();
      this.addResultId(option.dataset.value ?? '');
    });

    this.root.addEventListener('click', (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      if (target.matches('.list-remove-btn')) {
        this.removeValue(target.dataset.value ?? '');
      }
    });
  }

  private addResultId(id: string): void {
    const match = this.lookupResults.find((row) => row.id === String(id));
    if (match) {
      this.itemMeta.set(String(id).toLowerCase(), {
        label: String(match.label ?? ''),
        subLabel: String(match.subLabel ?? ''),
      });
    }

    this.addValues(id);
    this.requireElement<HTMLInputElement>('.lookup-input').value = '';
    this.lookupResults = [];
    this.lookupError = '';
    this.lookupLoading = false;
    this.renderLookupResults();
  }

  setLookupProvider(provider: LookupProvider | null): void {
    this.lookupProvider = typeof provider === 'function' ? provider : null;
    this.lookupError = '';
    this.lookupResults = [];
    this.lookupLoading = false;
    this.renderLookupResults();
  }

  private async runLookup(query: string): Promise<void> {
    if (!this.lookupProvider) {
      return;
    }

    const requestId = ++this.lookupRequestId;
    this.lookupLoading = true;
    this.lookupError = '';
    this.renderLookupResults();

    try {
      const results = await this.lookupProvider(query);
      if (requestId !== this.lookupRequestId) {
        return;
      }
      this.lookupResults = Array.isArray(results) ? results.slice(0, 10) : [];
      this.lookupError = '';
    } catch (error: unknown) {
      if (requestId !== this.lookupRequestId) {
        return;
      }
      this.lookupResults = [];
      this.lookupError = error instanceof Error ? error.message : String(error);
    } finally {
      if (requestId === this.lookupRequestId) {
        this.lookupLoading = false;
        this.renderLookupResults();
      }
    }
  }

  setItems(values: string[]): void {
    this.items = uniqueList(values ?? []);
    this.renderItems();
  }

  setItemMeta(metaObj: ItemMetaMap): void {
    this.itemMeta = new Map<string, ItemMeta>();
    const source = metaObj && typeof metaObj === 'object' ? metaObj : {};

    for (const [id, meta] of Object.entries(source)) {
      const key = String(id).toLowerCase();
      const label = String(meta?.label ?? '').trim();
      const subLabel = String(meta?.subLabel ?? '').trim();
      if (!label && !subLabel) {
        continue;
      }
      this.itemMeta.set(key, { label, subLabel });
    }

    this.renderItems();
  }

  getItemMeta(): ItemMetaMap {
    const out: ItemMetaMap = {};

    for (const [key, value] of this.itemMeta.entries()) {
      if (!this.items.some((item) => item.toLowerCase() === key)) {
        continue;
      }
      out[key] = {
        label: String(value.label ?? ''),
        subLabel: String(value.subLabel ?? ''),
      };
    }

    return out;
  }

  getItems(): string[] {
    return [...this.items];
  }

  private addValues(rawInput: string): void {
    const incoming = parseListField(rawInput);
    if (incoming.length === 0) {
      return;
    }
    this.items = uniqueList([...this.items, ...incoming]);
    this.renderItems();
    this.emitChange();
  }

  private removeValue(value: string): void {
    const removeKey = String(value).toLowerCase();
    const next = this.items.filter((v) => v.toLowerCase() !== removeKey);
    if (next.length === this.items.length) {
      return;
    }

    this.items = next;
    this.itemMeta.delete(removeKey);
    this.renderItems();
    this.emitChange();
  }

  private emitChange(): void {
    this.dispatchEvent(
      new CustomEvent<{ items: string[] }>('items-change', {
        bubbles: true,
        detail: { items: this.getItems() },
      }),
    );
  }

  private renderLookupResults(): void {
    const status = this.requireElement<HTMLElement>('.lookup-status');
    const panel = this.requireElement<HTMLElement>('.lookup-dropdown');
    const query = this.requireElement<HTMLInputElement>(
      '.lookup-input',
    ).value.trim();

    if (!this.lookupProvider) {
      status.textContent = 'Login to enable TIDAL search.';
      panel.innerHTML = '';
      return;
    }

    if (!query) {
      status.textContent = 'Type at least 2 characters to search TIDAL.';
      panel.innerHTML = '';
      return;
    }

    if (query.length < 2) {
      status.textContent = 'Type at least 2 characters to search.';
      panel.innerHTML = '';
      return;
    }

    if (this.lookupLoading) {
      status.textContent = 'Searching...';
      panel.innerHTML = `<div class="lookup-info">Searching...</div>`;
      return;
    }

    if (this.lookupError) {
      status.textContent = `Search failed: ${this.lookupError}`;
      panel.innerHTML = '';
      return;
    }

    status.textContent = `${this.lookupResults.length} result(s), max 10 shown`;

    const html = this.lookupResults.length === 0
      ? `<div class="lookup-info">No matches.</div>`
      : this.lookupResults
        .slice(0, 10)
        .map((result) => {
          const id = escapeHtml(result.id);
          const label = escapeHtml(result.label || result.id);
          const sub = result.subLabel ? `<small>${escapeHtml(result.subLabel)}</small>` : '';
          return `
              <button type="button" class="lookup-option" data-value="${id}">
                <span class="lookup-option-main">${label}</span>
                <code>${id}</code>
                ${sub}
              </button>
            `;
        })
        .join('');

    panel.innerHTML = html;
  }

  private renderItems(): void {
    const values = this.items;
    this.requireElement<HTMLElement>('.list-count').textContent = `${values.length} items`;

    const itemsHtml = values.length === 0 ? `<p class="list-empty">No items yet.</p>` : values
      .map(
        (value) => `
              <div class="list-item">
                <div class="list-item-text">
                  ${this.renderItemPrimary(value)}
                  <code>${escapeHtml(value)}</code>
                </div>
                <button type="button" class="list-remove-btn" data-value="${
          escapeHtml(value)
        }" aria-label="Remove ${escapeHtml(value)}">&times;</button>
              </div>
            `,
      )
      .join('');

    this.requireElement<HTMLElement>('.list-items').innerHTML = itemsHtml;
  }

  private renderItemPrimary(value: string): string {
    const meta = this.itemMeta.get(value.toLowerCase());
    if (!meta?.label) {
      return '';
    }
    const sub = meta.subLabel ? ` <small>${escapeHtml(meta.subLabel)}</small>` : '';
    return `<strong>${escapeHtml(meta.label)}</strong>${sub}`;
  }
}

customElements.define('list-manager', ListManager);
