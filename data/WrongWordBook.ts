/**
 * CONTRACT v1 wrong-word book: max 200 entries and review every three levels.
 *
 * R9 模式联动：所有模式写入同一个 WrongWordBook（本类），不另立存储。
 */
import { StorageManager } from '../core/StorageManager';
import { WordData } from './WordData';

export interface WrongWordEntry {
  word: WordData;
  wrongCount: number;
  firstWrongAt: number;
  lastWrongAt: number;
}

const SAVE_KEY = 'wrong_words';

export class WrongWordBook {
  private readonly entries = new Map<number, WrongWordEntry>();

  constructor(private readonly storage: StorageManager, private readonly capacity = 200) {
    if (!Number.isInteger(capacity) || capacity < 1) {
      throw new Error('Wrong-word capacity must be positive.');
    }
  }

  async load(): Promise<void> {
    const saved = await this.storage.load<WrongWordEntry[]>(SAVE_KEY, []);
    this.entries.clear();
    for (const entry of saved) {
      // 逐条校验，跳过损坏条目而非整本书作废
      if (!entry?.word || !Number.isInteger(entry.word.id) || !Number.isFinite(entry.lastWrongAt)) continue;
      this.entries.set(entry.word.id, entry);
    }
    this.trim();
  }

  async add(word: WordData, now = Date.now()): Promise<void> {
    const existing = this.entries.get(word.id);
    this.entries.set(word.id, existing
      ? { ...existing, word, wrongCount: existing.wrongCount + 1, lastWrongAt: now }
      : { word, wrongCount: 1, firstWrongAt: now, lastWrongAt: now });
    this.trim();
    await this.persist();
  }

  /** 复习答对即移出（不是标记，是删除——错词本只放还没掌握的）。 */
  async markReviewCorrect(wordId: number): Promise<boolean> {
    const removed = this.entries.delete(wordId);
    if (removed) await this.persist();
    return removed;
  }

  /** 每过 3 关推一次复习。bootcamp 的遗忘曲线复习读这里。 */
  shouldOfferReview(completedLevelCount: number): boolean {
    return this.entries.size > 0 && completedLevelCount > 0 && completedLevelCount % 3 === 0;
  }

  list(limit = this.capacity): WrongWordEntry[] {
    return [...this.entries.values()]
      .sort((left, right) => right.lastWrongAt - left.lastWrongAt)   // 最近错的优先
      .slice(0, Math.max(0, limit));
  }

  get size(): number { return this.entries.size; }

  /** 超容时按 lastWrongAt 淘汰最旧。 */
  private trim(): void {
    const oldestFirst = [...this.entries.values()].sort((l, r) => l.lastWrongAt - r.lastWrongAt);
    while (oldestFirst.length > this.capacity) {
      const oldest = oldestFirst.shift();
      if (oldest) this.entries.delete(oldest.word.id);
    }
  }

  private persist(): Promise<void> {
    return this.storage.save(SAVE_KEY, [...this.entries.values()]);
  }
}
