import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MarkdownRenderChild, TFile, type App, type Plugin } from 'obsidian';
import type { CardsAPI } from './types';
import type { WorkPropertiesManager } from './WorkPropertiesSessions';
import CardsSurface from './CardsSurface';
import { CARD_LANGUAGES, parseCardsEmbed, reorderCardsBlock } from './embed-source';
import { prepareNativeWrite } from './persistence';

export interface EmbeddedRuntime { api: CardsAPI; manager: WorkPropertiesManager; trackChild?: (child: MarkdownRenderChild) => (() => void); }

class CardsEmbedChild extends MarkdownRenderChild {
  private root?: Root;
  private stopped = false;
  private source: string;
  private untrack?: () => void;
  constructor(container: HTMLElement, private app: App, private runtime: EmbeddedRuntime, source: string, private path: string, private drafts: Map<string, string[]>) { super(container); this.source = source; }
  onload() {
    this.untrack ??= this.runtime.trackChild?.(this);
    const definition = parseCardsEmbed(this.source), key = `${this.path}\0${definition.id}`;
    const initialDraft = this.drafts.get(key);
    this.root = createRoot(this.containerEl);
    this.root.render(<CardsSurface api={this.runtime.api} manager={this.runtime.manager} embed={definition} initialDraft={initialDraft} retainDraft={draft => { if (draft) this.drafts.set(key, draft); else this.drafts.delete(key); }} saveOrder={async order => {
      const active = () => { if (this.stopped) throw new Error('笔记已关闭，排序草稿已保留。'); };
      active();
      const file = this.app.vault.getAbstractFileByPath(this.path);
      if (!(file instanceof TFile) || file.extension !== 'md') throw new Error('笔记已移动或删除，请重新打开后重试。');
      const assertEditors = await prepareNativeWrite(this.app, file, active);
      let updatedSource = '';
      await this.app.vault.process(file, text => { active(); assertEditors(text); const result = reorderCardsBlock(text, this.source, order); updatedSource = result.source; return result.text; });
      this.source = updatedSource;
    }} />);
  }
  onunload() { this.stopped = true; this.root?.unmount(); this.root = undefined; this.untrack?.(); this.untrack = undefined; }
}

export function registerCardsEmbeds(registrar: Plugin, resolveRuntime: (sourcePath: string) => EmbeddedRuntime | undefined, languages: readonly string[] = CARD_LANGUAGES): void {
  const drafts = new Map<string, string[]>();
  registrar.register(() => drafts.clear());
  for (const language of languages) registrar.registerMarkdownCodeBlockProcessor(language, (source, element, context) => {
    try {
      parseCardsEmbed(source);
      const runtime = resolveRuntime(context.sourcePath);
      if (!runtime) throw new Error('没有可用的卡片库。请启用 Magical Cards 并检查卡片目录。');
      context.addChild(new CardsEmbedChild(element, registrar.app, runtime, source, context.sourcePath, drafts));
    } catch (failure) {
      const message = element.ownerDocument.createElement('p'); message.className = 'bw-sync-note is-error'; message.setAttribute('role', 'alert'); message.textContent = failure instanceof Error ? failure.message : String(failure); element.replaceChildren(message);
    }
  });
}
