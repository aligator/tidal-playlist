import { css, html, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { StyledElement } from '../styled-element.ts';
import type { ItemMeta, ItemMetaMap, LookupProvider, LookupResult } from '../types.ts';
import { parseListField, uniqueCaseInsensitive } from '../modules/tidal/list-utils.ts';

@customElement('list-manager')
export class ListManager extends StyledElement {
  @state()
  private items: string[] = [];
  @state()
  private itemMeta = new Map<string, ItemMeta>();
  @state()
  private lookupProvider: LookupProvider | null = null;
  @state()
  private lookupResults: LookupResult[] = [];
  @state()
  private lookupError = '';
  @state()
  private lookupLoading = false;
  @state()
  private lookupQuery = '';

  @query('.lookup-input')
  private lookupInput!: HTMLInputElement;

  private lookupRequestId = 0;
  private lookupTimer: number | null = null;
  private hideTimer: number | null = null;

  static override localStyles = css`
    :host {
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
      position: absolute;
      top: calc(100% + 0.3rem);
      left: 0;
      right: 0;
      z-index: 30;
      max-height: 190px;
      overflow-y: auto;
      border: 1px solid var(--line, #d9dde3);
      border-radius: 8px;
      background: var(--panel, #fff);
      box-shadow: 0 6px 18px rgb(0 0 0 / 12%);
      padding: 0.25rem;
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
      cursor: pointer;
    }
    .list-empty {
      margin: 0;
      color: var(--muted, #6b7280);
    }
    input {
      width: 100%;
      padding: 0.5rem 0.6rem;
      box-sizing: border-box;
    }
  `;

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.lookupTimer !== null) clearTimeout(this.lookupTimer);
    if (this.hideTimer !== null) clearTimeout(this.hideTimer);
  }

  override render() {
    const title = this.getAttribute('title') ?? 'List';
    const lookupPlaceholder = this.getAttribute('lookup-placeholder') ?? 'Search in TIDAL';
    const statusText = this._computeStatus();
    const showDropdown = this._shouldShowDropdown();

    return html`
      <div class="list-manager">
        <div class="list-manager-head">
          <strong>${title}</strong>
          <span class="list-count">${this.items.length} items</span>
        </div>

        <div class="lookup-block">
          <div class="lookup-row">
            <input
              class="lookup-input"
              placeholder="${lookupPlaceholder}"
              autocomplete="off"
              @input="${(e: InputEvent) => this._onLookupInput(e)}"
              @focus="${() => this._onLookupFocus()}"
              @blur="${() => this._onLookupBlur()}"
              @keydown="${(e: KeyboardEvent) => this._onLookupKeydown(e)}"
            />
          </div>
          <div class="lookup-status">${statusText}</div>
          <div
            class="lookup-dropdown"
            .hidden="${!showDropdown}"
            @pointerdown="${(e: PointerEvent) => this._onDropdownPointerDown(e)}"
          >
            ${showDropdown ? this._renderDropdownContent() : nothing}
          </div>
        </div>

        <div class="list-items">
          ${this._renderItems()}
        </div>
      </div>
    `;
  }

  // ---------- public API ----------

  setItems(values: string[]): void {
    this.items = uniqueCaseInsensitive(values ?? []);
  }

  getItems(): string[] {
    return [...this.items];
  }

  setItemMeta(metaObj: ItemMetaMap): void {
    const newMeta = new Map<string, ItemMeta>();
    const source = metaObj && typeof metaObj === 'object' ? metaObj : ({} as ItemMetaMap);
    for (const [id, meta] of Object.entries(source)) {
      const key = String(id).toLowerCase();
      const label = String(meta?.label ?? '').trim();
      const subLabel = String(meta?.subLabel ?? '').trim();
      if (!label && !subLabel) continue;
      newMeta.set(key, { label, subLabel });
    }
    this.itemMeta = newMeta;
  }

  getItemMeta(): ItemMetaMap {
    const out: ItemMetaMap = {};
    for (const [key, value] of this.itemMeta.entries()) {
      if (!this.items.some((item) => item.toLowerCase() === key)) continue;
      out[key] = {
        label: String(value.label ?? ''),
        subLabel: String(value.subLabel ?? ''),
      };
    }
    return out;
  }

  setLookupProvider(provider: LookupProvider | null): void {
    this.lookupProvider = typeof provider === 'function' ? provider : null;
    this.lookupError = '';
    this.lookupResults = [];
    this.lookupLoading = false;
  }

  // ---------- private: event handlers ----------

  private _onLookupInput(e: InputEvent): void {
    const input = e.target as HTMLInputElement;
    const query = input.value.trim();
    this.lookupQuery = query;

    if (!this.lookupProvider || query.length < 2) {
      this.lookupResults = [];
      this.lookupError = '';
      this.lookupLoading = false;
      return;
    }

    if (this.lookupTimer !== null) clearTimeout(this.lookupTimer);
    this.lookupTimer = globalThis.setTimeout(() => {
      void this._runLookup(query);
    }, 220);
  }

  private _onLookupFocus(): void {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  private _onLookupBlur(): void {
    this.hideTimer = globalThis.setTimeout(() => {
      this.lookupResults = [];
      this.lookupLoading = false;
      this.lookupError = '';
    }, 120);
  }

  private _onLookupKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      const first = this.lookupResults[0];
      if (first?.id) {
        this._addResultId(first.id);
      }
    }
  }

  private _onDropdownPointerDown(e: PointerEvent): void {
    const target = e.target;
    if (!(target instanceof HTMLElement)) return;
    const option = target.closest('.lookup-option');
    if (!(option instanceof HTMLElement)) return;
    e.preventDefault(); // prevent input blur before click registers
    this._addResultId(option.dataset.value ?? '');
  }

  // ---------- private: lookup ----------

  private async _runLookup(query: string): Promise<void> {
    if (!this.lookupProvider) return;

    const requestId = ++this.lookupRequestId;
    this.lookupLoading = true;
    this.lookupError = '';

    try {
      const results = await this.lookupProvider(query);
      if (requestId !== this.lookupRequestId) return;
      this.lookupResults = Array.isArray(results) ? results.slice(0, 10) : [];
      this.lookupError = '';
    } catch (error: unknown) {
      if (requestId !== this.lookupRequestId) return;
      this.lookupResults = [];
      this.lookupError = error instanceof Error ? error.message : String(error);
    } finally {
      if (requestId === this.lookupRequestId) {
        this.lookupLoading = false;
      }
    }
  }

  private _addResultId(id: string): void {
    const match = this.lookupResults.find((r) => r.id === String(id));
    if (match) {
      const newMeta = new Map(this.itemMeta);
      newMeta.set(String(id).toLowerCase(), {
        label: String(match.label ?? ''),
        subLabel: String(match.subLabel ?? ''),
      });
      this.itemMeta = newMeta;
    }

    this._addValues(id);

    if (this.lookupInput) {
      this.lookupInput.value = '';
    }
    this.lookupQuery = '';
    this.lookupResults = [];
    this.lookupError = '';
    this.lookupLoading = false;
  }

  // ---------- private: items ----------

  private _addValues(rawInput: string): void {
    const incoming = parseListField(rawInput);
    if (incoming.length === 0) return;
    this.items = uniqueCaseInsensitive([...this.items, ...incoming]);
    this._emitChange();
  }

  private _removeValue(value: string): void {
    const removeKey = String(value).toLowerCase();
    const next = this.items.filter((v) => v.toLowerCase() !== removeKey);
    if (next.length === this.items.length) return;

    this.items = next;

    const newMeta = new Map(this.itemMeta);
    newMeta.delete(removeKey);
    this.itemMeta = newMeta;

    this._emitChange();
  }

  private _emitChange(): void {
    this.dispatchEvent(
      new CustomEvent<{ items: string[] }>('items-change', {
        bubbles: true,
        composed: true,
        detail: { items: this.getItems() },
      }),
    );
  }

  // ---------- private: render helpers ----------

  private _computeStatus(): string {
    if (!this.lookupProvider) return 'Login to enable TIDAL search.';
    if (!this.lookupQuery) return 'Type at least 2 characters to search TIDAL.';
    if (this.lookupQuery.length < 2) return 'Type at least 2 characters to search.';
    if (this.lookupLoading) return 'Searching...';
    if (this.lookupError) return `Search failed: ${this.lookupError}`;
    return `${this.lookupResults.length} result(s), max 10 shown`;
  }

  private _shouldShowDropdown(): boolean {
    if (!this.lookupProvider) return false;
    return this.lookupQuery.length >= 2;
  }

  private _renderDropdownContent() {
    if (this.lookupLoading) {
      return html`
        <div class="lookup-info">Searching...</div>
      `;
    }

    if (this.lookupResults.length === 0) {
      return html`
        <div class="lookup-info">No matches.</div>
      `;
    }

    return html`
      ${this.lookupResults.slice(0, 10).map(
        (result) =>
          html`
            <button
              type="button"
              class="lookup-option"
              data-value="${result.id}"
            >
              <span class="lookup-option-main">${result.label || result.id}</span>
              <code>${result.id}</code>
              ${result.subLabel
                ? html`
                  <small>${result.subLabel}</small>
                `
                : nothing}
            </button>
          `,
      )}
    `;
  }

  private _renderItems() {
    if (this.items.length === 0) {
      return html`
        <p class="list-empty">No items yet.</p>
      `;
    }

    return html`
      ${this.items.map(
        (value) =>
          html`
            <div class="list-item">
              <div class="list-item-text">
                ${this._renderItemPrimary(value)}
                <code>${value}</code>
              </div>
              <button
                type="button"
                class="list-remove-btn"
                aria-label="Remove ${value}"
                @click="${() => this._removeValue(value)}"
              >
                &times;
              </button>
            </div>
          `,
      )}
    `;
  }

  private _renderItemPrimary(value: string) {
    const meta = this.itemMeta.get(value.toLowerCase());
    if (!meta?.label) return nothing;
    return html`
      <strong>${meta.label}</strong>${meta.subLabel
        ? html`
          <small>${meta.subLabel}</small>
        `
        : nothing}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'list-manager': ListManager;
  }
}
