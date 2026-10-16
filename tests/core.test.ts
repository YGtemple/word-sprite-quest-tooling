import assert from 'node:assert/strict';
import test from 'node:test';
import { AdManager } from '../scripts/core/AdManager';
import { IPlatform, PlatformAdapter } from '../scripts/core/PlatformAdapter';
import { StorageManager } from '../scripts/core/StorageManager';
import { PlayerDataRepository, createDefaultPlayerData } from '../scripts/data/PlayerData';
import { WrongWordBook } from '../scripts/data/WrongWordBook';
import { WordData } from '../scripts/data/WordData';

/**
 * 构造一个内存版 IPlatform 替身。
 * storage 用 Map 实现，ad 的调用次数可观测——
 * 这样能在没有微信/抖音真机的环境下验证双平台抽象层。
 */
function mockPlatform() {
  const values = new Map<string, string>();
  let rewardedCalls = 0;
  let interstitialCalls = 0;
  const platform: IPlatform = {
    name: 'wechat',
    storage: {
      async setItem(key, value) { values.set(key, value); },
      async getItem(key) { return values.get(key) ?? null; },
      async removeItem(key) { values.delete(key); },
    },
    audio: { async playTTS() {}, playBGM() {}, playSFX() {}, stopBGM() {} },
    ad: {
      canShow: () => true,
      async showRewarded() { rewardedCalls += 1; return true; },
      async showInterstitial() { interstitialCalls += 1; },
    },
    social: {
      async submitScore() {}, async getRank() { return []; }, async challengeFriend() { return ''; },
      async syncSave() {}, async loadSave() { return null; },
    },
    system: { onMemoryWarning() {} },
  };
  return { platform, values, calls: () => ({ rewardedCalls, interstitialCalls }) };
}

function word(id: number): WordData {
  return {
    id, word: `word${id}`, phonetic: '', meaning: `meaning${id}`, pos: 'n.', category: 'test',
    synonyms: [], antonyms: [], example: '', example_trans: '', image_tag: `img_word${id}`,
    grammar_tags: [], frequency_rank: id,
  };
}

test('StorageManager round-trips data and recovers from corrupt JSON', async () => {
  const mock = mockPlatform();
  PlatformAdapter.setCurrent(mock.platform);
  const storage = new StorageManager('test');

  await storage.save('save', { value: 7 });
  assert.deepEqual(await storage.load('save', { value: 0 }), { value: 7 });

  // 信封损坏时必须回退 fallback，且不把坏数据留在存储里
  mock.values.set('test:save', '{bad json');
  assert.deepEqual(await storage.load('save', { value: 0 }), { value: 0 });
  assert.equal(mock.values.has('test:save'), false);
});

test('AdManager enforces cooldown and daily limit', async () => {
  const mock = mockPlatform();
  PlatformAdapter.setCurrent(mock.platform);

  // 用可控时钟验证冷却，不依赖真实时间
  let now = Date.UTC(2026, 6, 29);
  const ads = new AdManager({ rewarded: { cooldownMs: 1000, dailyLimit: 2 }, now: () => now });

  assert.equal(await ads.showRewarded('reward'), true);   // 第 1 次：通过
  assert.equal(await ads.showRewarded('reward'), false);  // 冷却中：拒绝
  now += 1000;
  assert.equal(await ads.showRewarded('reward'), true);   // 冷却过：通过（第 2 次，达日限）
  now += 1000;
  assert.equal(await ads.showRewarded('reward'), false);  // 达日限：拒绝

  assert.equal(mock.calls().rewardedCalls, 2);            // 底层只被调 2 次
});

test('PlayerData applies daily rewards once and evolves every two chapters', async () => {
  const mock = mockPlatform();
  PlatformAdapter.setCurrent(mock.platform);

  const repository = new PlayerDataRepository(new StorageManager('player-test'));
  const data = createDefaultPlayerData();

  // 同日重复登录只发一次奖
  assert.equal(repository.applyDailyLogin(data, '2026-07-29'), true);
  assert.equal(repository.applyDailyLogin(data, '2026-07-29'), false);

  assert.equal(repository.applyRewardedEnergy(data, '2026-07-29'), true);
  assert.equal(data.energy, 150);                          // 100 基础 + 50 登录

  // 每 2 章进化一阶
  repository.recordChapterCompletion(data, 2);
  assert.equal(data.petStage, 'growth');

  await repository.save(data);
  assert.equal((await repository.load()).petStage, 'growth');
});

test('WrongWordBook evicts the oldest entry and removes reviewed words', async () => {
  const mock = mockPlatform();
  PlatformAdapter.setCurrent(mock.platform);

  const book = new WrongWordBook(new StorageManager('wrong-test'), 2);  // 容量 2

  await book.add(word(1), 1);
  await book.add(word(2), 2);
  await book.add(word(3), 3);            // 挤掉最旧的 id=1

  assert.deepEqual(book.list().map((entry) => entry.word.id), [3, 2]);
  assert.equal(book.shouldOfferReview(3), true);

  assert.equal(await book.markReviewCorrect(2), true);   // 复习答对 → 移出
  assert.equal(book.size, 1);
});
