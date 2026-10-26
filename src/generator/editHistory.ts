/**
 * Ограниченный стек undo/redo для снапшотов-строк (T-802).
 * Снапшот — сериализованный JSON настроек; подряд идущие одинаковые склеиваются.
 */

export const EDIT_HISTORY_DEFAULT_CAP = 50;

export class EditHistory {
  private undoStack: string[] = [];
  private redoStack: string[] = [];
  readonly cap: number;

  constructor(cap: number = EDIT_HISTORY_DEFAULT_CAP) {
    this.cap = cap > 0 ? cap : EDIT_HISTORY_DEFAULT_CAP;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  get undoCount(): number {
    return this.undoStack.length;
  }

  get redoCount(): number {
    return this.redoStack.length;
  }

  /** Толкнуть прошлый снапшот; свежая правка сбрасывает redo-ветку. Дубликаты склеиваются. */
  push(snapshot: string): void {
    const last = this.undoStack[this.undoStack.length - 1];
    if (last !== undefined && last === snapshot) {
      this.redoStack = [];
      return;
    }
    this.undoStack.push(snapshot);
    while (this.undoStack.length > this.cap) this.undoStack.shift();
    this.redoStack = [];
  }

  /** Вернуть предыдущее состояние; current уходит в redo. */
  tryUndo(current: string): string | null {
    if (this.undoStack.length === 0) return null;
    const previous = this.undoStack.pop()!;
    this.redoStack.push(current);
    return previous;
  }

  /** Повторить отменённое; current возвращается в undo. */
  tryRedo(current: string): string | null {
    if (this.redoStack.length === 0) return null;
    const next = this.redoStack.pop()!;
    this.undoStack.push(current);
    while (this.undoStack.length > this.cap) this.undoStack.shift();
    return next;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
  }
}
