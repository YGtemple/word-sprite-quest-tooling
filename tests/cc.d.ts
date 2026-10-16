declare module 'cc' {
  /**
   * Cocos Creator 类型替身（仅用于 Node 环境下跑纯逻辑单测）。
   *
   * 为什么需要它：BaseLevel / LevelManager 等类 import 自 'cc'，
   * 但单测跑在 node --test 下没有 Cocos 运行时。只声明单测
   * 真正触达到的最小 API 面，保持足够小以便跟随引擎升级。
   */
  export class Node {
    emit(event: string, ...args: any[]): void;
    on(event: string, callback: (...args: any[]) => void, target?: unknown): void;
    off(event: string, callback: (...args: any[]) => void, target?: unknown): void;
    targetOff(target: unknown): void;
    addChild(child: Node): void;
    destroy(): void;
  }

  export class Component {
    node: Node;
    schedule(callback: () => void, interval?: number): void;
    unschedule(callback: () => void): void;
    scheduleOnce(callback: () => void, delay?: number): void;
    unscheduleAllCallbacks(): void;
  }

  export const _decorator: { ccclass(name: string): ClassDecorator };

  export class Asset {
    addRef(): Asset;
    decRef(): Asset;
  }

  export class JsonAsset extends Asset { json: unknown; }

  export class TextAsset extends Asset { text: string; }

  export namespace AssetManager {
    class Bundle {
      load<T extends Asset>(
        path: string,
        type: new (...args: any[]) => T,
        callback: (error: Error | null, asset?: T) => void,
      ): void;
      releaseAll(): void;
    }
  }

  export const assetManager: {
    loadBundle(
      name: string,
      callback: (error: Error | null, bundle?: AssetManager.Bundle) => void,
    ): void;
    removeBundle(bundle: AssetManager.Bundle): void;
  };

  export const resources: {
    load<T extends Asset>(
      path: string,
      type: new (...args: any[]) => T,
      callback: (error: Error | null, asset?: T) => void,
    ): void;
  };
}
