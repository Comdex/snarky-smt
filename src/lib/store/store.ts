import { Field } from 'snarkyjs';

export type { Store };

/**
 * Store is a key-value store interface
 *
 * @interface Store
 * @template V
 */
interface Store<V> {
  /**
   * Get nodes for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} key
   * @return {*}  {Promise<Field[]>}
   * @memberof Store
   */
  getNodes(key: Field): Promise<Field[]>;
  /**
   * Prepare put nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @param {Field[]} value
   * @memberof Store
   */
  preparePutNodes(key: Field, value: Field[]): void;
  /**
   * Prepare delete nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @memberof Store
   */
  prepareDelNodes(key: Field): void;
  /**
   * Get the value for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} path
   * @return {*}  {Promise<V>}
   * @memberof Store
   */
  getValue(key: Field): Promise<V>;
  /**
   * Prepare put the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @param {V} value
   * @memberof Store
   */
  preparePutValue(path: Field, value: V): void;
  /**
   * Prepare delete the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @memberof Store
   */
  prepareDelValue(path: Field): void;
  /**
   * Get the tree root. Error is thrown when the root does not exist.
   *
   * @return {*}  {Promise<Field>}
   * @memberof Store
   */
  getRoot(): Promise<Field>;
  /**
   * Prepare update the root. Use the commit() method to actually submit changes.
   *
   * @param {Field} root
   * @memberof Store
   */
  prepareUpdateRoot(root: Field): void;
  /**
   * Use the commit() method to actually submit all prepare changes.
   *
   * @return {*}  {Promise<void>}
   * @memberof Store
   */
  commit(): Promise<void>;
  /**
   * Clear all prepare operation cache.
   *
   * @memberof Store
   */
  clearPrepareOperationCache(): void;
  /**
   * Clear the store.
   *
   * @return {*}  {Promise<void>}
   * @memberof Store
   */
  clear(): Promise<void>;
  /**
   * Get values map, key is Field.toString().
   *
   * @return {*}  {Promise<Map<string, V>>}
   * @memberof Store
   */
  getValuesMap?(): Promise<Map<string, V>>;
}
