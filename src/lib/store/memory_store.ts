import { Field } from 'snarkyjs';
import { Store } from './store';

export { MemoryStore };

const enum SetType {
  nodes = 0,
  values = 1,
}

const enum OperationType {
  put = 0,
  del = 1,
}

/**
 * Store based on memory
 *
 * @class MemoryStore
 * @implements {Store<V>}
 * @template V
 */
class MemoryStore<V> implements Store<V> {
  protected nodesMap: Map<string, Field[]>;
  protected valuesMap: Map<string, V>;

  protected operationCache: {
    opType: OperationType;
    setType: SetType;
    k: string;
    v: any;
  }[];

  /**
   * Creates an instance of MemoryStore.
   * @memberof MemoryStore
   */
  constructor() {
    this.nodesMap = new Map<string, Field[]>();
    this.valuesMap = new Map<string, V>();
    this.operationCache = [];
  }

  /**
   * Clear all prepare operation cache.
   *
   * @memberof MemoryStore
   */
  public clearPrepareOperationCache(): void {
    this.operationCache = [];
  }

  /**
   * Get the tree root. Error is thrown when the root does not exist.
   *
   * @return {*}  {Promise<Field>}
   * @memberof MemoryStore
   */
  public async getRoot(): Promise<Field> {
    const fs = this.nodesMap.get('root');
    if (fs && fs.length == 1) {
      return fs[0];
    } else {
      throw new Error('Root does not exist');
    }
  }

  /**
   * Prepare update the root. Use the commit() method to actually submit changes.
   *
   * @param {Field} root
   * @memberof MemoryStore
   */
  public prepareUpdateRoot(root: Field): void {
    this.operationCache.push({
      opType: OperationType.put,
      setType: SetType.nodes,
      k: 'root',
      v: [root],
    });
  }

  /**
   * Get nodes for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} key
   * @return {*}  {Promise<Field[]>}
   * @memberof MemoryStore
   */
  public async getNodes(key: Field): Promise<Field[]> {
    let keyStr = key.toString();
    let nodes = this.nodesMap.get(keyStr);
    if (nodes) {
      return nodes;
    } else {
      throw new Error('invalid key: ' + keyStr);
    }
  }

  /**
   * Prepare put nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @param {Field[]} value
   * @memberof MemoryStore
   */
  public preparePutNodes(key: Field, value: Field[]): void {
    this.operationCache.push({
      opType: OperationType.put,
      setType: SetType.nodes,
      k: key.toString(),
      v: value,
    });
  }

  /**
   * Prepare delete nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @memberof MemoryStore
   */
  public prepareDelNodes(key: Field): void {
    this.operationCache.push({
      opType: OperationType.del,
      setType: SetType.nodes,
      k: key.toString(),
      v: undefined,
    });
  }

  /**
   * Get the value for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} path
   * @return {*}  {Promise<V>}
   * @memberof MemoryStore
   */
  public async getValue(path: Field): Promise<V> {
    const pathStr = path.toString();
    const v = this.valuesMap.get(pathStr);

    if (v) {
      return v;
    } else {
      throw new Error('invalid key: ' + pathStr);
    }
  }

  /**
   * Prepare put the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @param {V} value
   * @memberof MemoryStore
   */
  public preparePutValue(path: Field, value: V): void {
    this.operationCache.push({
      opType: OperationType.put,
      setType: SetType.values,
      k: path.toString(),
      v: value,
    });
  }

  /**
   * Prepare delete the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @memberof MemoryStore
   */
  public prepareDelValue(path: Field): void {
    this.operationCache.push({
      opType: OperationType.del,
      setType: SetType.values,
      k: path.toString(),
      v: undefined,
    });
  }

  /**
   * Use the commit() method to actually submit all prepare changes.
   *
   * @return {*}  {Promise<void>}
   * @memberof MemoryStore
   */
  public async commit(): Promise<void> {
    for (let i = 0, len = this.operationCache.length; i < len; i++) {
      const v = this.operationCache[i];
      if (v.opType === OperationType.put) {
        if (v.setType === SetType.nodes) {
          this.nodesMap.set(v.k, v.v);
        } else {
          this.valuesMap.set(v.k, v.v);
        }
      } else {
        if (v.setType === SetType.nodes) {
          this.nodesMap.delete(v.k);
        } else {
          this.valuesMap.delete(v.k);
        }
      }
    }

    // console.log(
    //   '[commit] current nodes size: ',
    //   this.nodesMap.size,
    //   ', current values size: ',
    //   this.valuesMap.size
    // );

    this.clearPrepareOperationCache();
  }

  /**
   * Clear the store.
   *
   * @return {*}  {Promise<void>}
   * @memberof MemoryStore
   */
  public async clear(): Promise<void> {
    this.nodesMap.clear();
    this.valuesMap.clear();
  }

  /**
   * Get values map, key is Field.toString().
   *
   * @return {*}  {Promise<Map<string, V>>}
   * @memberof MemoryStore
   */
  public async getValuesMap(): Promise<Map<string, V>> {
    return this.valuesMap;
  }
}
