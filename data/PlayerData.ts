/**
 * CONTRACT v1 player save model and repository.
 *
 * 这份存档的设计重点是 normalize()：**读档时必须防御**。
 * 存档可能来自旧版本、被手工编辑过、或写入中途断电损坏。
 */
import { StorageManager } from '../core/StorageManager';

export type PetStage = 'spirit' | 'growth' | 'awakened' | 'ultra' | 'ultimate';

export interface LearningReportEntry {
  date: string;
  answered: number;
  correct: number;
  durationMs: number;
}

export interface PlayerData {
  schemaVersion: 1;
  petStage: PetStage;
  energy: number;
  coins: number;
  highestUnlockedChapter: number;
  highestCompletedLevel: number;
  ownedSkins: string[];
  equippedSkin: string;
  learningReports: LearningReportEntry[];
  lastLoginDate: string;
  rewardedEnergyDate: string;
}

const SAVE_KEY = 'player';
const STAGES: PetStage[] = ['spirit', 'growth', 'awakened', 'ultra', 'ultimate'];

export function createDefaultPlayerData(): PlayerData {
  return {
    schemaVersion: 1,
    petStage: 'spirit',
    energy: 0,
    coins: 0,
    highestUnlockedChapter: 1,
    highestCompletedLevel: 0,
    ownedSkins: ['pet_basic'],
    equippedSkin: 'pet_basic',
    learningReports: [],
    lastLoginDate: '',
    rewardedEnergyDate: '',
  };
}

export class PlayerDataRepository {
  constructor(private readonly storage: StorageManager) {}

  /** load 和 save 都过 normalize——写入侧也规范化，防止坏数据落盘。 */
  async load(): Promise<PlayerData> {
    const value = await this.storage.load<unknown>(SAVE_KEY, createDefaultPlayerData());
    return this.normalize(value);
  }

  async save(data: PlayerData): Promise<void> {
    await this.storage.save(SAVE_KEY, this.normalize(data));
  }

  applyDailyLogin(data: PlayerData, dateKey: string): boolean {
    if (!dateKey || data.lastLoginDate === dateKey) return false;
    data.lastLoginDate = dateKey;
    data.energy += 50;                     // §11.4 登录日历
    return true;
  }

  applyRewardedEnergy(data: PlayerData, dateKey: string): boolean {
    if (!dateKey || data.rewardedEnergyDate === dateKey) return false;
    data.rewardedEnergyDate = dateKey;
    data.energy += 100;                    // §11.3 看广告得体力
    return true;
  }

  recordChapterCompletion(data: PlayerData, chapter: number): void {
    if (!Number.isInteger(chapter) || chapter < 1 || chapter > 8) {
      throw new Error(`Invalid chapter: ${chapter}`);
    }
    data.highestCompletedLevel = Math.max(data.highestCompletedLevel, chapter * 30);
    data.highestUnlockedChapter = Math.min(8, Math.max(data.highestUnlockedChapter, chapter + 1));

    // 每 2 章进化一阶，Math.min(4, floor(chapter/2)) 防越界
    data.petStage = STAGES[Math.min(4, Math.floor(chapter / 2))];
  }

  /**
   * 存档规范化。三条原则：
   *   1. 每个字段都做类型与范围校验，非法即回退默认
   *   2. 拥有的皮肤列表去重，且保证含 pet_basic
   *      （用户可能手动删了默认皮肤，导致无皮肤可用）
   *   3. equippedSkin 必须在 ownedSkins 里，否则回退 pet_basic
   *      （防止穿着一个没买的皮肤）
   *   4. 学习报告 slice(-90) 只留最近 90 天，防存档无限膨胀
   */
  private normalize(candidate: unknown): PlayerData {
    const defaults = createDefaultPlayerData();
    if (!candidate || typeof candidate !== 'object') return defaults;
    const value = candidate as Partial<PlayerData>;

    const skins = Array.isArray(value.ownedSkins)
      ? [...new Set(value.ownedSkins.filter((s): s is string => typeof s === 'string' && s.length > 0))]
      : defaults.ownedSkins;
    if (!skins.includes('pet_basic')) skins.unshift('pet_basic');

    const reports = Array.isArray(value.learningReports)
      ? value.learningReports.filter((e): e is LearningReportEntry => this.isReport(e)).slice(-90)
      : [];

    return {
      schemaVersion: 1,
      petStage: STAGES.includes(value.petStage as PetStage) ? (value.petStage as PetStage) : defaults.petStage,
      energy: this.nonNegative(value.energy),
      coins: this.nonNegative(value.coins),
      highestUnlockedChapter: this.clampInteger(value.highestUnlockedChapter, 1, 8, 1),
      highestCompletedLevel: this.clampInteger(value.highestCompletedLevel, 0, 240, 0),
      ownedSkins: skins,
      equippedSkin: skins.includes(value.equippedSkin ?? '') ? (value.equippedSkin as string) : 'pet_basic',
      learningReports: reports,
      lastLoginDate: typeof value.lastLoginDate === 'string' ? value.lastLoginDate : '',
      rewardedEnergyDate: typeof value.rewardedEnergyDate === 'string' ? value.rewardedEnergyDate : '',
    };
  }

  private isReport(value: unknown): value is LearningReportEntry {
    if (!value || typeof value !== 'object') return false;
    const entry = value as Partial<LearningReportEntry>;
    return typeof entry.date === 'string'
      && Number.isFinite(entry.answered) && (entry.answered as number) >= 0
      && Number.isFinite(entry.correct) && (entry.correct as number) >= 0
      && Number.isFinite(entry.durationMs) && (entry.durationMs as number) >= 0;
  }

  private nonNegative(value: unknown): number {
    return Number.isFinite(value) ? Math.max(0, value as number) : 0;
  }

  private clampInteger(value: unknown, min: number, max: number, fallback: number): number {
    return Number.isInteger(value) ? Math.max(min, Math.min(max, value as number)) : fallback;
  }
}
