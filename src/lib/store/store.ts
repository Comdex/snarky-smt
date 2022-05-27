import { Field } from 'snarkyjs';
import { FieldElements } from '../model';
/**
 * Store is a key-value store interface
 *
 * @export
 * @interface Store
 * @template V
 */
export interface Store<V extends FieldElements> {
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
   * Get the value for a key.
   *
   * @param {Field} path
   * @return {*}  {Promise<V>}
   * @memberof Store
   */
  getValue(path: Field): Promise<V>;
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
   * Get the tree root
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
   * Get values map.
   *
   * @return {*}  {Promise<Map<string, V>>}
   * @memberof Store
   */
  getValuesMap?(): Promise<Map<string, V>>;
}
