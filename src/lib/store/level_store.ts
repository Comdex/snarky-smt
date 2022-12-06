import { Level } from 'level';
import { Field, Provable } from 'snarkyjs';
import { strToFieldArry } from '../utils';
import { Store } from './store';
import {
  AbstractBatchPutOperation,
  AbstractBatchDelOperation,
  AbstractSublevel,
} from 'abstract-level';

export { LevelStore };

/**
 * Store based on leveldb
 *
 * @class LevelStore
 * @implements {Store<V>}
 * @template V
 */
class LevelStore<V> implements Store<V> {
  protected db: Level<string, any>;
  protected nodesSubLevel: AbstractSublevel<
    Level<string, any>,
    string | Buffer | Uint8Array,
    string,
    string
  >;
  protected leavesSubLevel: AbstractSublevel<
    Level<string, any>,
    string | Buffer | Uint8Array,
    string,
    string
  >;
  protected operationCache: (
    | AbstractBatchPutOperation<Level<string, any>, string, any>
    | AbstractBatchDelOperation<Level<string, any>, string>
  )[];
  protected eltTyp: Provable<V>;

  /**
   * Creates an instance of LevelStore.
   * @param {Level<string, any>} db
   * @param {Provable<V>} eltTyp
   * @param {string} smtName
   * @memberof LevelStore
   */
  constructor(db: Level<string, any>, eltTyp: Provable<V>, smtName: string) {
    this.db = db;
    this.nodesSubLevel = this.db.sublevel(smtName);
    this.leavesSubLevel = this.db.sublevel(smtName + '_leaf');
    this.operationCache = [];
    this.eltTyp = eltTyp;
  }

  /**
   * Clear all prepare operation cache.
   *
   * @memberof LevelStore
   */
  public clearPrepareOperationCache(): void {
    this.operationCache = [];
  }

  /**
   * Get the tree root. Error is thrown when the root does not exist.
   *
   * @return {*}  {Promise<Field>}
   * @memberof LevelStore
   */
  public async getRoot(): Promise<Field> {
    const valueStr = await this.nodesSubLevel.get('root');
    return Field(valueStr);
  }

  /**
   * Prepare update the root. Use the commit() method to actually submit changes.
   *
   * @param {Field} root
   * @memberof LevelStore
   */
  public prepareUpdateRoot(root: Field): void {
    this.operationCache.push({
      type: 'put',
      sublevel: this.nodesSubLevel,
      key: 'root',
      value: root.toString(),
    });
  }

  /**
   * Get nodes for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} key
   * @return {*}  {Promise<Field[]>}
   * @memberof LevelStore
   */
  public async getNodes(key: Field): Promise<Field[]> {
    const valueStr = await this.nodesSubLevel.get(key.toString());
    return strToFieldArry(valueStr);
  }

  /**
   * Prepare put nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @param {Field[]} value
   * @memberof LevelStore
   */
  public preparePutNodes(key: Field, value: Field[]): void {
    this.operationCache.push({
      type: 'put',
      sublevel: this.nodesSubLevel,
      key: key.toString(),
      value: value.toString(),
    });
  }

  /**
   * Prepare delete nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @memberof LevelStore
   */
  public prepareDelNodes(key: Field): void {
    this.operationCache.push({
      type: 'del',
      sublevel: this.nodesSubLevel,
      key: key.toString(),
    });
  }

  /**
   * Convert value string to a value of FieldElements type.
   *
   * @protected
   * @param {string} valueStr
   * @param {AsFieldElements<V>} eltTyp
   * @return {*}  {V}
   * @memberof LevelStore
   */
  protected strToValue(valueStr: string, eltTyp: Provable<V>): V {
    let fs = strToFieldArry(valueStr);
    return eltTyp.fromFields(fs, eltTyp.toAuxiliary());
  }

  /**
   * Get the value for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} path
   * @return {*}  {Promise<V>}
   * @memberof LevelStore
   */
  public async getValue(path: Field): Promise<V> {
    const valueStr = await this.leavesSubLevel.get(path.toString());

    return this.strToValue(valueStr, this.eltTyp);
  }

  /**
   * Serialize the value of the FieldElements type into a string
   *
   * @protected
   * @param {V} value
   * @return {*}  {string}
   * @memberof LevelStore
   */
  protected valueToStr(value: V): string {
    const valueStr = this.eltTyp.toFields(value).toString();

    return valueStr;
  }

  /**
   * Prepare put the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @param {V} value
   * @memberof LevelStore
   */
  public preparePutValue(path: Field, value: V): void {
    const valueStr = this.valueToStr(value);
    this.operationCache.push({
      type: 'put',
      sublevel: this.leavesSubLevel,
      key: path.toString(),
      value: valueStr,
    });
  }

  /**
   * Prepare delete the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @memberof LevelStore
   */
  public prepareDelValue(path: Field): void {
    this.operationCache.push({
      type: 'del',
      sublevel: this.leavesSubLevel,
      key: path.toString(),
    });
  }

  /**
   * Use the commit() method to actually submit all prepare changes.
   *
   * @return {*}  {Promise<void>}
   * @memberof LevelStore
   */
  public async commit(): Promise<void> {
    if (this.operationCache.length > 0) {
      await this.db.batch(this.operationCache);
    }

    this.clearPrepareOperationCache();
  }

  /**
   * Clear the store.
   *
   * @return {*}  {Promise<void>}
   * @memberof LevelStore
   */
  public async clear(): Promise<void> {
    await this.nodesSubLevel.clear();
    await this.leavesSubLevel.clear();
  }

  /**
   * Get values map, key is Field.toString().
   *
   * @return {*}  {Promise<Map<string, V>>}
   * @memberof LevelStore
   */
  public async getValuesMap(): Promise<Map<string, V>> {
    let valuesMap = new Map<string, V>();
    for await (const [key, valueStr] of this.leavesSubLevel.iterator()) {
      const value = this.strToValue(valueStr, this.eltTyp);
      valuesMap.set(key, value);
    }

    return valuesMap;
  }
}
