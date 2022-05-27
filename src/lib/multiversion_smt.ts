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

/**
 * A sparse merkle tree that stores all version changes. Due to uncontrolled storage growth, only for testing purposes.
 *
 * @export
 * @class MultiVersionSparseMerkleTree
 * @template K
 * @template V
 */
export class MultiVersionSparseMerkleTree<
  K extends FieldElements,
  V extends FieldElements
> {
  private root: Field;
  private store: Store<V>;
  private hasher: Hasher;

  /**
   * Build a new multiversion sparse merkle tree
   *
   * @static
   * @template K
   * @template V
   * @param {Store<V>} store
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Promise<MultiVersionSparseMerkleTree<K, V>>}
   * @memberof MultiVersionSparseMerkleTree
   */
  static async buildNewTree<K extends FieldElements, V extends FieldElements>(
    store: Store<V>,
    hasher: Hasher = Poseidon.hash
  ): Promise<MultiVersionSparseMerkleTree<K, V>> {
    store.clearPrepareOperationCache();
    for (let i = 0; i < SMT_DEPTH; i++) {
      const keyNode = defaultNodes(hasher)[i];
      const value = defaultNodes(hasher)[i + 1];
      const values = [value, value];
      store.preparePutNodes(keyNode, values);
    }

    const root = defaultNodes(hasher)[0];
    store.prepareUpdateRoot(root);
    await store.commit();

    return new MultiVersionSparseMerkleTree(root, store, hasher);
  }

  /**
   * Import a multiversion sparse merkle tree via existing store
   *
   * @static
   * @template K
   * @template V
   * @param {Store<V>} store
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Promise<MultiVersionSparseMerkleTree<K, V>>}
   * @memberof MultiVersionSparseMerkleTree
   */
  static async importTree<K extends FieldElements, V extends FieldElements>(
    store: Store<V>,
    hasher: Hasher = Poseidon.hash
  ): Promise<MultiVersionSparseMerkleTree<K, V>> {
    const root: Field = await store.getRoot();

    return new MultiVersionSparseMerkleTree(root, store, hasher);
  }

  private constructor(root: Field, store: Store<V>, hasher: Hasher) {
    this.store = store;
    this.hasher = hasher;
    this.root = root;
  }

  /**
   * Get the root of the tree.
   *
   * @return {*}  {Field}
   * @memberof MultiVersionSparseMerkleTree
   */
  getRoot(): Field {
    return this.root;
  }

  /**
   * Check if the tree is empty.
   *
   * @return {*}  {boolean}
   * @memberof MultiVersionSparseMerkleTree
   */
  isEmpty(): boolean {
    let emptyRoot = defaultNodes(this.hasher)[0];
    return this.root.equals(emptyRoot).toBoolean();
  }

  /**
   * Get the depth of the tree.
   *
   * @return {*}  {number}
   * @memberof MultiVersionSparseMerkleTree
   */
  depth(): number {
    return SMT_DEPTH;
  }

  /**
   * Set the root of the tree.
   *
   * @param {Field} root
   * @memberof MultiVersionSparseMerkleTree
   */
  async setRoot(root: Field) {
    this.store.clearPrepareOperationCache();
    this.store.prepareUpdateRoot(root);
    await this.store.commit();
    this.root = root;
  }

  /**
   * Get the data store of the tree.
   *
   * @return {*}  {Store<V>}
   * @memberof MultiVersionSparseMerkleTree
   */
  getStore(): Store<V> {
    return this.store;
  }

  /**
   * Get the hasher function used by the tree.
   *
   * @return {*}  {Hasher}
   * @memberof MultiVersionSparseMerkleTree
   */
  getHasher(): Hasher {
    return this.hasher;
  }

  /**
   * Get the value of a key from the tree.
   *
   * @param {K} key
   * @return {*}  {(Promise<V | null>)}
   * @memberof MultiVersionSparseMerkleTree
   */
  async get(key: K): Promise<V | null> {
    if (this.isEmpty()) {
      throw new Error('Key does not exist');
    }

    const pathBits = this.digest(key.toFields()).toBits();
    let currentHash = this.root;

    for (let i = 0; i < this.depth(); i++) {
      let currentValue: Field[];
      try {
        currentValue = await this.store.getNodes(currentHash);
      } catch (err) {
        console.log(err);
        return null;
      }

      if (pathBits[i].toBoolean() === RIGHT) {
        currentHash = currentValue[1];
      } else {
        currentHash = currentValue[0];
      }
    }

    if (currentHash.equals(SMT_EMPTY_VALUE).toBoolean()) {
      return null;
    }
    return await this.store.getValue(currentHash);
  }

  /**
   * Check if the key exists in the tree.
   *
   * @param {K} key
   * @return {*}  {Promise<boolean>}
   * @memberof MultiVersionSparseMerkleTree
   */
  async has(key: K): Promise<boolean> {
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
   * @memberof MultiVersionSparseMerkleTree
   */
  async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Delete a value from tree and return the new root of the tree.
   *
   * @param {K} key
   * @return {*}  {Promise<Field>}
   * @memberof MultiVersionSparseMerkleTree
   */
  async delete(key: K): Promise<Field> {
    return await this.update(key);
  }

  /**
   * Update a new value for a key in the tree and return the new root of the tree.
   *
   * @param {K} key
   * @param {V} [value]
   * @return {*}  {Promise<Field>}
   * @memberof MultiVersionSparseMerkleTree
   */
  async update(key: K, value?: V): Promise<Field> {
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
   * @memberof MultiVersionSparseMerkleTree
   */
  async updateAll(kvs: { key: K; value?: V }[]): Promise<Field> {
    this.store.clearPrepareOperationCache();
    let newRoot: Field = this.root;
    for (let i = 0; i < kvs.length; i++) {
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
   * @memberof MultiVersionSparseMerkleTree
   */
  async prove(key: K): Promise<SparseMerkleProof> {
    return await this.proveForRoot(this.root, key);
  }

  /**
   * Create a compacted merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<SparseCompactMerkleProof>}
   * @memberof MultiVersionSparseMerkleTree
   */
  async proveCompact(key: K): Promise<SparseCompactMerkleProof> {
    const proof = await this.prove(key);
    return compactProof(proof, this.hasher);
  }

  private digest(data: Field[]): Field {
    return this.hasher(data);
  }

  private async updateForRoot(root: Field, key: K, value?: V): Promise<Field> {
    const path = this.digest(key.toFields());
    const { sideNodes, leafData } = await this.sideNodesForRoot(root, path);

    const newRoot: Field = this.updateWithSideNodes(
      sideNodes,
      leafData,
      path,
      value
    );
    return newRoot;
  }

  private updateWithSideNodes(
    sideNodes: Field[],
    oldLeafData: Field,
    path: Field,
    value?: V
  ): Field {
    let currentHash: Field;
    if (value !== undefined) {
      currentHash = this.digest(value.toFields());
      this.store.preparePutValue(currentHash, value);
    } else {
      currentHash = SMT_EMPTY_VALUE;
    }

    // console.log('oldLeafData: ', oldLeafData.toString());

    if (oldLeafData.equals(currentHash).toBoolean()) {
      return this.root;
    }

    this.store.preparePutNodes(currentHash, [currentHash]);

    const pathBits = path.toBits();
    for (let i = this.depth() - 1; i >= 0; i--) {
      const sideNode = sideNodes[i];
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

  private async sideNodesForRoot(
    root: Field,
    path: Field
  ): Promise<{ sideNodes: Field[]; pathNodes: Field[]; leafData: Field }> {
    const pathBits = path.toBits();
    let sideNodes: Field[] = [];
    let pathNodes: Field[] = [];
    pathNodes.push(root);

    let nodeHash: Field = root;
    let sideNode: Field;
    for (let i = 0; i < this.depth(); i++) {
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

  private async proveForRoot(root: Field, key: K): Promise<SparseMerkleProof> {
    const path = this.digest(key.toFields());
    const { sideNodes } = await this.sideNodesForRoot(root, path);

    return new SparseMerkleProof(sideNodes);
  }
}
