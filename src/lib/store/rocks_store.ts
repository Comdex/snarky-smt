import { Provable, Field } from 'snarkyjs';
import { strToFieldArry } from '../utils';
import { Store } from './store';

import levelup from 'levelup';

export { RocksStore };

/**
 * Store based on rocksdb
 *
 * @class RocksStore
 * @implements {Store<V>}
 * @template V
 */
class RocksStore<V> implements Store<V> {
  protected db: levelup.LevelUp;
  protected batch: levelup.LevelUpChain;
  protected nodesKey: string;
  protected leavesKey: string;
  protected eltTyp: Provable<V>;

  /**
   * Creates an instance of RocksStore.
   * @param {levelup.LevelUp} db
   * @param {Provable<V>} eltTyp
   * @param {string} smtName
   * @memberof RocksStore
   */
  constructor(db: levelup.LevelUp, eltTyp: Provable<V>, smtName: string) {
    this.db = db;
    this.batch = db.batch();
    this.nodesKey = smtName + ':';
    this.leavesKey = smtName + '_leaf:';
    this.eltTyp = eltTyp;
  }

  /**
   * Clear all prepare operation cache.
   *
   * @memberof RocksStore
   */
  public clearPrepareOperationCache(): void {
    this.batch = this.db.batch();
  }

  /**
   * Get the tree root. Error is thrown when the root does not exist.
   *
   * @return {*}  {Promise<Field>}
   * @memberof RocksStore
   */
  public async getRoot(): Promise<Field> {
    const valueStr = await this.db.get(this.nodesKey + 'root');
    return Field(valueStr);
  }

  /**
   * Prepare update the root. Use the commit() method to actually submit changes.
   *
   * @param {Field} root
   * @memberof RocksStore
   */
  public prepareUpdateRoot(root: Field): void {
    this.batch = this.batch.put(this.nodesKey + 'root', root.toString());
  }

  /**
   * Get nodes for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} key
   * @return {*}  {Promise<Field[]>}
   * @memberof RocksStore
   */
  public async getNodes(key: Field): Promise<Field[]> {
    const valueStr = await this.db.get(this.nodesKey + key.toString());

    return strToFieldArry(valueStr);
  }

  /**
   * Prepare put nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @param {Field[]} value
   * @memberof RocksStore
   */
  public preparePutNodes(key: Field, value: Field[]): void {
    this.batch = this.batch.put(
      this.nodesKey + key.toString(),
      value.toString()
    );
  }

  /**
   * Prepare delete nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @memberof RocksStore
   */
  public prepareDelNodes(key: Field): void {
    this.batch = this.batch.del(this.nodesKey + key.toString());
  }

  /**
   * Convert value string to a value of FieldElements type.
   *
   * @protected
   * @param {string} valueStr
   * @param {AsFieldElements<V>} eltTyp
   * @return {*}  {V}
   * @memberof RocksStore
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
   * @memberof RocksStore
   */
  public async getValue(path: Field): Promise<V> {
    const valueStr = await this.db.get(this.leavesKey + path.toString());

    return this.strToValue(valueStr, this.eltTyp);
  }

  /**
   * Serialize the value of the FieldElements type into a string
   *
   * @protected
   * @param {V} value
   * @return {*}  {string}
   * @memberof RocksStore
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
   * @memberof RocksStore
   */
  public preparePutValue(path: Field, value: V): void {
    const valueStr = this.valueToStr(value);
    this.batch = this.batch.put(this.leavesKey + path.toString(), valueStr);
  }

  /**
   * Prepare delete the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @memberof RocksStore
   */
  public prepareDelValue(path: Field): void {
    this.batch = this.batch.del(this.leavesKey + path.toString());
  }

  /**
   * Use the commit() method to actually submit all prepare changes.
   *
   * @return {*}  {Promise<void>}
   * @memberof RocksStore
   */
  public async commit(): Promise<void> {
    if (this.batch.length > 0) {
      await this.batch.write();
    }

    this.clearPrepareOperationCache();
  }

  /**
   * Clear the store.
   *
   * @return {*}  {Promise<void>}
   * @memberof RocksStore
   */
  public async clear(): Promise<void> {
    await this.db.clear();
  }

  /**
   * Get values map, key is Field.toString().
   *
   * @return {*}  {Promise<Map<string, V>>}
   * @memberof RocksStore
   */
  public async getValuesMap(): Promise<Map<string, V>> {
    let valuesMap = new Map<string, V>();
    // @ts-ignore
    for await (const [key, valueStr] of this.db.iterator()) {
      const value = this.strToValue(valueStr, this.eltTyp);
      const realKey = (key as string).replace(this.leavesKey, '');
      valuesMap.set(realKey, value);
    }

    return valuesMap;
  }
}
