import { Level } from 'level';
import { AsFieldElements, Field } from 'snarkyjs';
import { strToFieldArry } from '../utils';
import { Store } from './store';
import {
  AbstractBatchPutOperation,
  AbstractBatchDelOperation,
  AbstractSublevel,
} from 'abstract-level';
import { FieldElements } from '../model';

export class LevelStore<V extends FieldElements> implements Store<V> {
  private db: Level<string, any>;
  private nodesSubLevel: AbstractSublevel<
    Level<string, any>,
    string | Buffer | Uint8Array,
    string,
    string
  >;
  private leavesSubLevel: AbstractSublevel<
    Level<string, any>,
    string | Buffer | Uint8Array,
    string,
    string
  >;
  private operationCache: (
    | AbstractBatchPutOperation<Level<string, any>, string, any>
    | AbstractBatchDelOperation<Level<string, any>, string>
  )[];
  private eltTyp: AsFieldElements<V>;

  constructor(
    db: Level<string, any>,
    eltTyp: AsFieldElements<V>,
    smtName: string
  ) {
    this.db = db;
    this.nodesSubLevel = this.db.sublevel(smtName);
    this.leavesSubLevel = this.db.sublevel(smtName + '_leaf');
    this.operationCache = [];
    this.eltTyp = eltTyp;
  }

  clearPrepareOperationCache(): void {
    this.operationCache = [];
  }

  async getRoot(): Promise<Field> {
    const valueStr = await this.nodesSubLevel.get('root');
    return Field(valueStr);
  }

  prepareUpdateRoot(root: Field): void {
    this.operationCache.push({
      type: 'put',
      sublevel: this.nodesSubLevel,
      key: 'root',
      value: root.toString(),
    });
  }

  async getNodes(key: Field): Promise<Field[]> {
    const valueStr = await this.nodesSubLevel.get(key.toString());
    return strToFieldArry(valueStr);
  }

  preparePutNodes(key: Field, value: Field[]): void {
    this.operationCache.push({
      type: 'put',
      sublevel: this.nodesSubLevel,
      key: key.toString(),
      value: value.toString(),
    });
  }

  prepareDelNodes(key: Field): void {
    this.operationCache.push({
      type: 'del',
      sublevel: this.nodesSubLevel,
      key: key.toString(),
    });
  }

  async getValue(path: Field): Promise<V> {
    const valueStr = await this.leavesSubLevel.get(path.toString());
    let fs = strToFieldArry(valueStr);
    return this.eltTyp.ofFields(fs);
  }

  preparePutValue(path: Field, value: V): void {
    const valueStr = value.toFields().toString();
    this.operationCache.push({
      type: 'put',
      sublevel: this.leavesSubLevel,
      key: path.toString(),
      value: valueStr,
    });
  }

  prepareDelValue(path: Field): void {
    this.operationCache.push({
      type: 'del',
      sublevel: this.leavesSubLevel,
      key: path.toString(),
    });
  }

  async commit(): Promise<void> {
    if (this.operationCache.length > 0) {
      await this.db.batch(this.operationCache);
    }

    this.clearPrepareOperationCache();
  }

  async clear(): Promise<void> {
    await this.nodesSubLevel.clear();
    await this.leavesSubLevel.clear();
  }

  async getValuesMap(): Promise<Map<string, V>> {
    let valuesMap = new Map<string, V>();
    for await (const [key, valueStr] of this.leavesSubLevel.iterator()) {
      let fs = strToFieldArry(valueStr);
      let value = this.eltTyp.ofFields(fs);
      valuesMap.set(key, value);
    }

    return valuesMap;
  }
}
