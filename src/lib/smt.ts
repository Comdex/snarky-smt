import { Field, Poseidon } from 'snarkyjs';
import { RIGHT, SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import {
  compactProof,
  Hasher,
  SparseCompactMerkleProof,
  SparseMerkleProof,
} from './proofs';
import { Store } from './store/store';
import { defaultNodes } from './default_nodes';
import { FieldElements } from './model';

export { SparseMerkleTree };

/**
 * Sparse Merkle Tree
 *
 * @export
 * @class SparseMerkleTree
 * @template K
 * @template V
 */
class SparseMerkleTree<K extends FieldElements, V extends FieldElements> {
  /**
   * Initial empty tree root based on poseidon hash algorithm
   *
   * @static
   * @memberof SparseMerkleTree
   */
  static initialPoseidonHashRoot = Field(
    '1363491840476538827947652000140631540976546729195695784589068790317102403216'
  );

  protected root: Field;
  protected store: Store<V>;
  protected hasher: Hasher;
  protected config: { hashKey: boolean; hashValue: boolean };

  /**
   * Build a new sparse merkle tree
   *
   * @static
   * @template K
   * @template V
   * @param {Store<V>} store
   * @param {{ hasher?: Hasher; hashKey?: boolean; hashValue?: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]
   * @return {*}  {Promise<SparseMerkleTree<K, V>>}
   * @memberof SparseMerkleTree
   */
  public static async buildNewTree<
    K extends FieldElements,
    V extends FieldElements
  >(
    store: Store<V>,
    options: { hasher?: Hasher; hashKey?: boolean; hashValue?: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): Promise<SparseMerkleTree<K, V>> {
    let hasher: Hasher = Poseidon.hash;
    let config = { hashKey: true, hashValue: true };
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    if (options.hashKey !== undefined) {
      config.hashKey = options.hashKey;
    }
    if (options.hashValue !== undefined) {
      config.hashValue = options.hashValue;
    }

    store.clearPrepareOperationCache();
    for (let i = 0; i < SMT_DEPTH; i++) {
      let keyNode = defaultNodes(hasher)[i];
      let value = defaultNodes(hasher)[i + 1];
      let values = [value, value];
      store.preparePutNodes(keyNode, values);
    }

    const root = defaultNodes(hasher)[0];
    store.prepareUpdateRoot(root);
    await store.commit();

    return new SparseMerkleTree(root, store, hasher, config);
  }

  /**
   * Import a sparse merkle tree via existing store
   *
   * @static
   * @template K
   * @template V
   * @param {Store<V>} store
   * @param {{ hasher?: Hasher; hashKey?: boolean; hashValue?: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]
   * @return {*}  {Promise<SparseMerkleTree<K, V>>}
   * @memberof SparseMerkleTree
   */
  public static async importTree<
    K extends FieldElements,
    V extends FieldElements
  >(
    store: Store<V>,
    options: { hasher?: Hasher; hashKey?: boolean; hashValue?: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): Promise<SparseMerkleTree<K, V>> {
    let hasher: Hasher = Poseidon.hash;
    let config = { hashKey: true, hashValue: true };
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    if (options.hashKey !== undefined) {
      config.hashKey = options.hashKey;
    }
    if (options.hashValue !== undefined) {
      config.hashValue = options.hashValue;
    }

    const root: Field = await store.getRoot();

    return new SparseMerkleTree(root, store, hasher, config);
  }

  private constructor(
    root: Field,
    store: Store<V>,
    hasher: Hasher,
    config: { hashKey: boolean; hashValue: boolean }
  ) {
    this.store = store;
    this.hasher = hasher;
    this.config = config;
    this.root = root;
  }

  private getKeyField(key: K): Field {
    let keyFields = key.toFields();
    let keyHashOrKeyField = keyFields[0];
    if (this.config.hashKey) {
      keyHashOrKeyField = this.digest(keyFields);
    } else {
      if (keyFields.length > 1) {
        throw new Error(
          `The length of key fields is greater than 1, the key needs to be hashed before it can be processed, option 'hashKey' must be set to true`
        );
      }
    }

    return keyHashOrKeyField;
  }

  /**
   * Get the root of the tree.
   *
   * @return {*}  {Field}
   * @memberof SparseMerkleTree
   */
  public getRoot(): Field {
    return this.root;
  }

  /**
   * Check if the tree is empty.
   *
   * @return {*}  {boolean}
   * @memberof SparseMerkleTree
   */
  public isEmpty(): boolean {
    const emptyRoot = defaultNodes(this.hasher)[0];
    return this.root.equals(emptyRoot).toBoolean();
  }

  /**
   * Get the depth of the tree.
   *
   * @return {*}  {number}
   * @memberof SparseMerkleTree
   */
  public depth(): number {
    return SMT_DEPTH;
  }

  /**
   * Set the root of the tree.
   *
   * @param {Field} root
   * @memberof SparseMerkleTree
   */
  public async setRoot(root: Field) {
    this.store.clearPrepareOperationCache();
    this.store.prepareUpdateRoot(root);
    await this.store.commit();
    this.root = root;
  }

  /**
   * Get the data store of the tree.
   *
   * @return {*}  {Store<V>}
   * @memberof SparseMerkleTree
   */
  public getStore(): Store<V> {
    return this.store;
  }

  /**
   * Get the hasher function used by the tree.
   *
   * @return {*}  {Hasher}
   * @memberof SparseMerkleTree
   */
  public getHasher(): Hasher {
    return this.hasher;
  }

  /**
   * Get the value for a key from the tree.
   *
   * @param {K} key
   * @return {*}  {(Promise<V | null>)}
   * @memberof SparseMerkleTree
   */
  public async get(key: K): Promise<V | null> {
    if (this.isEmpty()) {
      return null;
    }

    let path = this.getKeyField(key);

    try {
      const value = await this.store.getValue(path);
      return value;
    } catch (err: any) {
      console.log(err);
      // if (err.code === 'LEVEL_NOT_FOUND') {
      //   return null;
      // }
      // throw err;
      return null;
    }
  }

  /**
   * Check if the key exists in the tree.
   *
   * @param {K} key
   * @return {*}  {Promise<boolean>}
   * @memberof SparseMerkleTree
   */
  public async has(key: K): Promise<boolean> {
    const v = await this.get(key);
    if (v === null) {
      return false;
    }

    return true;
  }

  /**
   * Clear the tree.
   *
   * @return {*}  {Promise<void>}
   * @memberof SparseMerkleTree
   */
  public async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Delete a value from tree and return the new root of the tree.
   *
   * @param {K} key
   * @return {*}  {Promise<Field>}
   * @memberof SparseMerkleTree
   */
  public async delete(key: K): Promise<Field> {
    return await this.update(key);
  }

  /**
   * Update a new value for a key in the tree and return the new root of the tree.
   *
   * @param {K} key
   * @param {V} [value]
   * @return {*}  {Promise<Field>}
   * @memberof SparseMerkleTree
   */
  public async update(key: K, value?: V): Promise<Field> {
    this.store.clearPrepareOperationCache();
    const newRoot = await this.updateForRoot(this.root, key, value);
    this.store.prepareUpdateRoot(newRoot);
    await this.store.commit();
    this.root = newRoot;

    return this.root;
  }

  /**
   * Update multiple leaves and return the new root of the tree.
   *
   * @param {{ key: K; value?: V }[]} kvs
   * @return {*}  {Promise<Field>}
   * @memberof SparseMerkleTree
   */
  public async updateAll(kvs: { key: K; value?: V }[]): Promise<Field> {
    this.store.clearPrepareOperationCache();
    let newRoot: Field = this.root;
    for (let i = 0, len = kvs.length; i < len; i++) {
      newRoot = await this.updateForRoot(newRoot, kvs[i].key, kvs[i].value);
    }
    this.store.prepareUpdateRoot(newRoot);
    await this.store.commit();
    this.root = newRoot;

    return this.root;
  }

  /**
   * Create a merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<SparseMerkleProof>}
   * @memberof SparseMerkleTree
   */
  public async prove(key: K): Promise<SparseMerkleProof> {
    return await this.proveForRoot(this.root, key);
  }

  /**
   * Create a compacted merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<SparseCompactMerkleProof>}
   * @memberof SparseMerkleTree
   */
  public async proveCompact(key: K): Promise<SparseCompactMerkleProof> {
    const proof = await this.prove(key);
    return compactProof(proof, this.hasher);
  }

  protected digest(data: Field[]): Field {
    return this.hasher(data);
  }

  protected async updateForRoot(
    root: Field,
    key: K,
    value?: V
  ): Promise<Field> {
    let path = this.getKeyField(key);

    const { sideNodes, pathNodes, leafData } = await this.sideNodesForRoot(
      root,
      path
    );

    const newRoot: Field = this.updateWithSideNodes(
      sideNodes,
      pathNodes,
      leafData,
      path,
      value
    );
    return newRoot;
  }

  protected updateWithSideNodes(
    sideNodes: Field[],
    pathNodes: Field[],
    oldLeafData: Field,
    path: Field,
    value?: V
  ): Field {
    let currentHash: Field;
    if (value !== undefined) {
      const valueFields = value.toFields();

      if (this.config.hashValue) {
        currentHash = this.digest(valueFields);
      } else {
        if (valueFields.length > 1) {
          throw new Error(
            `The length of value fields is greater than 1, the value needs to be hashed before it can be processed, option 'hashValue' must be set to true`
          );
        }

        currentHash = valueFields[0];
      }

      this.store.preparePutValue(path, value);
    } else {
      currentHash = SMT_EMPTY_VALUE;
      this.store.prepareDelValue(path);
    }

    if (oldLeafData.equals(currentHash).toBoolean()) {
      return this.root;
    } else {
      if (!oldLeafData.equals(SMT_EMPTY_VALUE).toBoolean()) {
        for (let i = 0, len = pathNodes.length; i < len; i++) {
          this.store.prepareDelNodes(pathNodes[i]);
        }
      }
    }

    this.store.preparePutNodes(currentHash, [currentHash]);

    const pathBits = path.toBits();
    for (let i = this.depth() - 1; i >= 0; i--) {
      let sideNode = sideNodes[i];
      let currentValue = [];
      if (pathBits[i].toBoolean() === RIGHT) {
        currentValue = [sideNode, currentHash];
      } else {
        currentValue = [currentHash, sideNode];
      }

      currentHash = this.digest(currentValue);
      this.store.preparePutNodes(currentHash, currentValue);
    }

    return currentHash;
  }

  protected async sideNodesForRoot(
    root: Field,
    path: Field
  ): Promise<{ sideNodes: Field[]; pathNodes: Field[]; leafData: Field }> {
    const pathBits = path.toBits();
    let sideNodes: Field[] = [];
    let pathNodes: Field[] = [];
    pathNodes.push(root);

    let nodeHash: Field = root;
    let sideNode: Field;
    for (let i = 0, depth = this.depth(); i < depth; i++) {
      const currentValue = await this.store.getNodes(nodeHash);
      if (pathBits[i].toBoolean() === RIGHT) {
        sideNode = currentValue[0];
        nodeHash = currentValue[1];
      } else {
        sideNode = currentValue[1];
        nodeHash = currentValue[0];
      }
      sideNodes.push(sideNode);
      pathNodes.push(nodeHash);
    }

    let leafData: Field;
    if (!nodeHash.equals(SMT_EMPTY_VALUE).toBoolean()) {
      let leaf = await this.store.getNodes(nodeHash);
      leafData = leaf[0];
    } else {
      leafData = SMT_EMPTY_VALUE;
    }

    return {
      sideNodes,
      pathNodes: pathNodes.reverse(),
      leafData,
    };
  }

  protected async proveForRoot(
    root: Field,
    key: K
  ): Promise<SparseMerkleProof> {
    let path = this.getKeyField(key);

    const { sideNodes } = await this.sideNodesForRoot(root, path);

    return new SparseMerkleProof(sideNodes, root);
  }
}
