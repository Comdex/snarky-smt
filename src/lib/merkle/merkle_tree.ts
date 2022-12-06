import { Field, Poseidon, Provable } from 'snarkyjs';

import { EMPTY_VALUE, RIGHT, SMT_DEPTH } from '../constant';
import { defaultNodes } from '../default_nodes';
import { Hasher } from '../model';
import { Store } from '../store/store';
import { BaseMerkleProof, CompactMerkleProof, MerkleTreeUtils } from './proofs';
import { ProvableMerkleTreeUtils } from './verify_circuit';

export { MerkleTree };

/**
 * Merkle Tree.
 *
 * @class MerkleTree
 * @template V
 */
class MerkleTree<V> {
  protected root: Field;
  protected store: Store<V>;
  protected hasher: Hasher;
  protected readonly height: number;
  protected readonly maxNumIndex: bigint;
  protected readonly hashValue: boolean;
  protected valueType: Provable<V>;

  /**
   * Build a new merkle tree.
   *
   * @static
   * @template V
   * @param {Store<V>} store
   * @param {number} height
   * @param {Provable<V>} valueType
   * @param {{ hasher?: Hasher; hashValue?: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash;
   * hashValue: whether to hash the value, the default is true.
   * @return {*}  {Promise<MerkleTree<V>>}
   * @memberof MerkleTree
   */
  public static async build<V>(
    store: Store<V>,
    height: number,
    valueType: Provable<V>,
    options: { hasher?: Hasher; hashValue?: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): Promise<MerkleTree<V>> {
    if (height > SMT_DEPTH || height < 1) {
      throw new Error(`The height must be between 1 and ${SMT_DEPTH}`);
    }

    let hasher: Hasher = Poseidon.hash;
    let hashValue = true;
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    if (options.hashValue !== undefined) {
      hashValue = options.hashValue;
    }

    store.clearPrepareOperationCache();

    for (let i = 0; i < height; i++) {
      let keyNode = defaultNodes(hasher, height)[i];
      let value = defaultNodes(hasher, height)[i + 1];
      let values = [value, value];

      store.preparePutNodes(keyNode, values);
    }

    const root = defaultNodes(hasher, height)[0];
    store.prepareUpdateRoot(root);
    await store.commit();

    return new MerkleTree(root, store, height, valueType, hasher, hashValue);
  }

  /**
   * Import a merkle tree via existing store.
   *
   * @static
   * @template V
   * @param {Store<V>} store
   * @param {number} height
   * @param {Provable<V>} valueType
   * @param {{ hasher?: Hasher; hashValue?: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash;
   * hashValue: whether to hash the value, the default is true.
   * @return {*}  {Promise<MerkleTree<V>>}
   * @memberof MerkleTree
   */
  public static async import<V>(
    store: Store<V>,
    height: number,
    valueType: Provable<V>,
    options: { hasher?: Hasher; hashValue?: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): Promise<MerkleTree<V>> {
    if (height > SMT_DEPTH || height < 1) {
      throw new Error('The height must be between 1 and ' + SMT_DEPTH);
    }
    let hasher: Hasher = Poseidon.hash;
    let hashValue = true;
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    if (options.hashValue !== undefined) {
      hashValue = options.hashValue;
    }

    const root: Field = await store.getRoot();

    return new MerkleTree(root, store, height, valueType, hasher, hashValue);
  }

  private constructor(
    root: Field,
    store: Store<V>,
    height: number,
    valueType: Provable<V>,
    hasher: Hasher,
    hashValue: boolean
  ) {
    if (height > SMT_DEPTH || height < 1) {
      throw new Error('The height must be between 1 and ' + SMT_DEPTH);
    }

    this.store = store;
    this.hasher = hasher;
    this.hashValue = hashValue;
    this.root = root;
    this.height = height;

    let h = BigInt(height);
    this.maxNumIndex = 2n ** h - 1n;

    this.valueType = valueType;
  }

  /**
   * Get the root of the tree.
   *
   * @return {*}  {Field}
   * @memberof MerkleTree
   */
  public getRoot(): Field {
    return this.root;
  }

  /**
   * Check if the tree is empty.
   *
   * @return {*}  {boolean}
   * @memberof MerkleTree
   */
  public isEmpty(): boolean {
    const emptyRoot = defaultNodes(this.hasher, this.height)[0];
    return this.root.equals(emptyRoot).toBoolean();
  }

  /**
   * Get the depth of the tree.
   *
   * @return {*}  {number}
   * @memberof MerkleTree
   */
  public depth(): number {
    return this.height;
  }

  /**
   * Set the root of the tree.
   *
   * @param {Field} root
   * @memberof MerkleTree
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
   * @memberof MerkleTree
   */
  public getStore(): Store<V> {
    return this.store;
  }

  /**
   * Get the hasher function used by the tree.
   *
   * @return {*}  {Hasher}
   * @memberof MerkleTree
   */
  public getHasher(): Hasher {
    return this.hasher;
  }

  /**
   * Get the value for an index from the tree.
   *
   * @param {bigint} index
   * @return {*}  {(Promise<V | null>)}
   * @memberof MerkleTree
   */
  public async get(index: bigint): Promise<V | null> {
    if (this.isEmpty()) {
      return null;
    }

    let path = Field(index);

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
   * Check if the index exists in the tree.
   *
   * @param {bigint} index
   * @return {*}  {Promise<boolean>}
   * @memberof MerkleTree
   */
  public async has(index: bigint): Promise<boolean> {
    const v = await this.get(index);
    if (v === null) {
      return false;
    }

    return true;
  }

  /**
   * Clear the tree.
   *
   * @return {*}  {Promise<void>}
   * @memberof MerkleTree
   */
  public async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Delete a value from tree and return the new root of the tree.
   *
   * @param {bigint} index
   * @return {*}  {Promise<Field>}
   * @memberof MerkleTree
   */
  public async delete(index: bigint): Promise<Field> {
    return await this.update(index);
  }

  /**
   * Update a new value for an index in the tree and return the new root of the tree.
   *
   * @param {bigint} index
   * @param {V} [value]
   * @return {*}  {Promise<Field>}
   * @memberof MerkleTree
   */
  public async update(index: bigint, value?: V): Promise<Field> {
    this.store.clearPrepareOperationCache();
    const newRoot = await this.updateForRoot(this.root, index, value);
    this.store.prepareUpdateRoot(newRoot);
    await this.store.commit();
    this.root = newRoot;

    return this.root;
  }

  /**
   * Update multiple leaves and return the new root of the tree.
   *
   * @param {{ index: bigint; value?: V }[]} ivs
   * @return {*}  {Promise<Field>}
   * @memberof MerkleTree
   */
  public async updateAll(ivs: { index: bigint; value?: V }[]): Promise<Field> {
    this.store.clearPrepareOperationCache();
    let newRoot: Field = this.root;
    for (let i = 0, len = ivs.length; i < len; i++) {
      newRoot = await this.updateForRoot(newRoot, ivs[i].index, ivs[i].value);
    }
    this.store.prepareUpdateRoot(newRoot);
    await this.store.commit();
    this.root = newRoot;

    return this.root;
  }

  /**
   * Create a merkle proof for an index against the current root.
   *
   * @param {bigint} index
   * @return {*}  {Promise<BaseMerkleProof>}
   * @memberof MerkleTree
   */
  public async prove(index: bigint): Promise<BaseMerkleProof> {
    return await this.proveForRoot(this.root, index);
  }

  /**
   * Create a compacted merkle proof for an index against the current root.
   *
   * @param {bigint} index
   * @return {*}  {Promise<CompactMerkleProof>}
   * @memberof MerkleTree
   */
  public async proveCompact(index: bigint): Promise<CompactMerkleProof> {
    const proof = await this.prove(index);
    return MerkleTreeUtils.compactMerkleProof(proof, this.hasher);
  }

  protected digest(data: Field[]): Field {
    return this.hasher(data);
  }

  protected async updateForRoot(
    root: Field,
    key: bigint,
    value?: V
  ): Promise<Field> {
    if (key > this.maxNumIndex) {
      throw new Error(
        'The numeric index can only be between 0 and ' + this.maxNumIndex
      );
    }

    const path = Field(key);
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
      const valueFields = this.valueType.toFields(value);

      if (this.hashValue) {
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
      currentHash = EMPTY_VALUE;
      this.store.prepareDelValue(path);
    }

    if (oldLeafData.equals(currentHash).toBoolean()) {
      return this.root;
    } else {
      if (oldLeafData.equals(EMPTY_VALUE).not().toBoolean()) {
        for (let i = 0, len = pathNodes.length; i < len; i++) {
          this.store.prepareDelNodes(pathNodes[i]);
        }
      }
    }

    this.store.preparePutNodes(currentHash, [currentHash]);

    const pathBits = path.toBits(this.height);
    for (let i = this.height - 1; i >= 0; i--) {
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
    const pathBits = path.toBits(this.height);

    let sideNodes: Field[] = [];
    let pathNodes: Field[] = [];
    pathNodes.push(root);

    let nodeHash: Field = root;
    let sideNode: Field;
    for (let i = 0; i < this.height; i++) {
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

    if (!nodeHash.equals(EMPTY_VALUE).toBoolean()) {
      let leaf = await this.store.getNodes(nodeHash);
      leafData = leaf[0];
    } else {
      leafData = EMPTY_VALUE;
    }

    return {
      sideNodes,
      pathNodes: pathNodes.reverse(),
      leafData,
    };
  }

  protected async proveForRoot(
    root: Field,
    key: bigint
  ): Promise<BaseMerkleProof> {
    const path = Field(key);
    const { sideNodes } = await this.sideNodesForRoot(root, path);

    class MerkleProof_ extends ProvableMerkleTreeUtils.MerkleProof(
      this.depth()
    ) {}

    return new MerkleProof_(root, sideNodes);
  }
}
