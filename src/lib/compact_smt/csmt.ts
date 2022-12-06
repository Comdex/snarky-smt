import { Field, Poseidon, Provable } from 'snarkyjs';
import { ERR_KEY_ALREADY_EMPTY, RIGHT } from '../constant';
import { Hasher } from '../model';
import { Store } from '../store/store';
import { countCommonPrefix } from '../utils';
import { CP_PADD_VALUE, CSMT_DEPTH, PLACEHOLDER } from './constant';
import {
  CompactSparseMerkleProof,
  CSMTUtils,
  CSparseCompactMerkleProof,
} from './proofs';
import { TreeHasher } from './tree_hasher';

export { CompactSparseMerkleTree };

/**
 * Compact Sparse Merkle Tree
 *
 * @class CompactSparseMerkleTree
 * @template K
 * @template V
 */
class CompactSparseMerkleTree<K, V> {
  protected th: TreeHasher<K, V>;
  protected store: Store<V>;
  protected root: Field;
  protected config: { hashKey: boolean; hashValue: boolean };
  protected keyType: Provable<K>;
  protected valueType: Provable<V>;

  /**
   * Creates an instance of CompactSparseMerkleTree.
   * @param {Store<V>} store
   * @param {Provable<K>} keyType
   * @param {Provable<V>} valueType
   * @param {Field} [root]
   * @param {{ hasher?: Hasher; hashKey?: boolean; hashValue?: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash; hashKey:
   * whether to hash the key, the default is true; hashValue: whether to hash the value,
   * the default is true.
   * @memberof CompactSparseMerkleTree
   */
  constructor(
    store: Store<V>,
    keyType: Provable<K>,
    valueType: Provable<V>,
    root?: Field,
    options: { hasher?: Hasher; hashKey?: boolean; hashValue?: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ) {
    let hasher = Poseidon.hash;
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    let config = { hashKey: true, hashValue: true };
    if (options.hashKey !== undefined) {
      config.hashKey = options.hashKey;
    }
    if (options.hashValue !== undefined) {
      config.hashValue = options.hashValue;
    }

    this.th = new TreeHasher<K, V>(hasher, keyType, valueType);
    this.store = store;
    this.config = config;
    if (root) {
      this.root = root;
    } else {
      this.root = PLACEHOLDER;
    }

    this.keyType = keyType;
    this.valueType = valueType;
  }

  /**
   * Import a compacted sparse merkle tree
   *
   * @static
   * @template K
   * @template V
   * @param {Store<V>} store
   * @param {Provable<K>} keyType
   * @param {Provable<V>} valueType
   * @param {{ hasher?: Hasher; hashKey?: boolean; hashValue?: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash; hashKey:
   * whether to hash the key, the default is true; hashValue: whether to hash the value,
   * the default is true.
   * @return {*}  {Promise<CompactSparseMerkleTree<K, V>>}
   * @memberof CompactSparseMerkleTree
   */
  static async import<K, V>(
    store: Store<V>,
    keyType: Provable<K>,
    valueType: Provable<V>,
    options: { hasher?: Hasher; hashKey?: boolean; hashValue?: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): Promise<CompactSparseMerkleTree<K, V>> {
    let hasher = Poseidon.hash;
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    let config = { hashKey: true, hashValue: true };
    if (options.hashKey !== undefined) {
      config.hashKey = options.hashKey;
    }
    if (options.hashValue !== undefined) {
      config.hashValue = options.hashValue;
    }

    const root = await store.getRoot();
    if (root === null) {
      throw new Error('Root does not exist in store');
    }
    return new CompactSparseMerkleTree(store, keyType, valueType, root, config);
  }

  protected getKeyField(key: K): Field {
    let keyField = null;
    if (this.config.hashKey) {
      keyField = this.th.path(key);
    } else {
      let keyFields = this.keyType.toFields(key);
      if (keyFields.length > 1) {
        throw new Error(
          `The length of key fields is greater than 1, the key needs to be hashed before it can be processed, option 'hashKey' must be set to true`
        );
      }
      keyField = keyFields[0];
    }

    return keyField;
  }

  /**
   * Get the root of the tree.
   *
   * @return {*}  {Field}
   * @memberof CompactSparseMerkleTree
   */
  public getRoot(): Field {
    return this.root;
  }

  /**
   * Get the tree hasher used by the tree.
   *
   * @return {*}  {TreeHasher<K, V>}
   * @memberof CompactSparseMerkleTree
   */
  public getTreeHasher(): TreeHasher<K, V> {
    return this.th;
  }

  /**
   * Get the data store of the tree.
   *
   * @return {*}  {Store<V>}
   * @memberof CompactSparseMerkleTree
   */
  public getStore(): Store<V> {
    return this.store;
  }

  /**
   * Set the root of the tree.
   *
   * @param {Field} root
   * @return {*}  {Promise<void>}
   * @memberof CompactSparseMerkleTree
   */
  public async setRoot(root: Field): Promise<void> {
    this.store.clearPrepareOperationCache();
    this.store.prepareUpdateRoot(root);
    await this.store.commit();
    this.root = root;
  }

  /**
   * Get the depth of the tree.
   *
   * @return {*}  {number}
   * @memberof CompactSparseMerkleTree
   */
  public depth(): number {
    return CSMT_DEPTH;
  }

  /**
   * Clear the tree.
   *
   * @return {*}  {Promise<void>}
   * @memberof CompactSparseMerkleTree
   */
  public async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Get the value for a key from the tree.
   *
   * @param {K} key
   * @return {*}  {(Promise<V | null>)}
   * @memberof CompactSparseMerkleTree
   */
  public async get(key: K): Promise<V | null> {
    if (this.root.equals(PLACEHOLDER).toBoolean()) {
      throw new Error('Key does not exist');
    }

    const path = this.getKeyField(key);
    return await this.store.getValue(path);
  }

  /**
   * Check if the key exists in the tree.
   *
   * @param {K} key
   * @return {*}  {Promise<boolean>}
   * @memberof CompactSparseMerkleTree
   */
  async has(key: K): Promise<boolean> {
    const v = await this.get(key);
    if (v === null) {
      return false;
    }

    return true;
  }

  /**
   * Update a new value for a key in the tree and return the new root of the tree.
   *
   * @param {K} key
   * @param {V} [value]
   * @return {*}  {Promise<Field>}
   * @memberof CompactSparseMerkleTree
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
   * @memberof CompactSparseMerkleTree
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
   * Delete a value from tree and return the new root of the tree.
   *
   * @param {K} key
   * @return {*}  {Promise<Field>}
   * @memberof CompactSparseMerkleTree
   */
  async delete(key: K): Promise<Field> {
    return this.update(key);
  }

  /**
   * Create a merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<CSparseMerkleProof>}
   * @memberof CompactSparseMerkleTree
   */
  async prove(key: K): Promise<CompactSparseMerkleProof> {
    return await this.doProveForRoot(this.root, key, false);
  }

  /**
   * Create an updatable Merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<CSparseMerkleProof>}
   * @memberof CompactSparseMerkleTree
   */
  async proveUpdatable(key: K): Promise<CompactSparseMerkleProof> {
    return await this.doProveForRoot(this.root, key, true);
  }

  /**
   * Create a compacted merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<CSparseCompactMerkleProof>}
   * @memberof CompactSparseMerkleTree
   */
  async proveCompact(key: K): Promise<CSparseCompactMerkleProof> {
    return await this.proveCompactForRoot(this.root, key);
  }

  private async proveCompactForRoot(
    root: Field,
    key: K
  ): Promise<CSparseCompactMerkleProof> {
    const proof = await this.doProveForRoot(root, key, false);
    return CSMTUtils.compactProof(proof, this.th.getHasher());
  }

  private async doProveForRoot(
    root: Field,
    key: K,
    isUpdatable: boolean
  ): Promise<CompactSparseMerkleProof> {
    const path = this.getKeyField(key);

    let {
      sideNodes,
      pathNodes,
      currentData: leafData,
      siblingData,
    } = await this.sideNodesForRoot(path, root, isUpdatable);

    let nonMembershipLeafData = this.th.emptyData(); // set default empty data

    if (pathNodes[0].equals(PLACEHOLDER).not().toBoolean()) {
      const { path: actualPath } = this.th.parseLeaf(leafData!);
      if (actualPath.equals(path).not().toBoolean()) {
        nonMembershipLeafData = leafData!;
      }
    }

    if (siblingData === null) {
      siblingData = this.th.emptyData();
    }
    return new CompactSparseMerkleProof({
      sideNodes,
      nonMembershipLeafData,
      siblingData,
      root,
    });
  }

  private async updateForRoot(root: Field, key: K, value?: V): Promise<Field> {
    const path = this.getKeyField(key);

    let {
      sideNodes,
      pathNodes,
      currentData: oldLeafData,
    } = await this.sideNodesForRoot(path, root, false);

    let newRoot: Field;
    if (value === undefined) {
      // delete
      try {
        newRoot = await this.deleteWithSideNodes(
          path,
          sideNodes,
          pathNodes,
          oldLeafData!
        );
      } catch (err) {
        console.log(err);
        const e = err as Error;
        if (e.message === ERR_KEY_ALREADY_EMPTY) {
          return root;
        }
      }

      this.store.prepareDelValue(path);
    } else {
      newRoot = this.updateWithSideNodes(
        path,
        value,
        sideNodes,
        pathNodes,
        oldLeafData!
      );
    }

    return newRoot!;
  }

  private updateWithSideNodes(
    path: Field,
    value: V,
    sideNodes: Field[],
    pathNodes: Field[],
    oldLeafData: Field[]
  ): Field {
    let valueField = null;
    if (this.config.hashValue) {
      valueField = this.th.digestValue(value);
    } else {
      let valueFields = this.valueType.toFields(value);
      if (valueFields.length > 1) {
        throw new Error(
          `The length of value fields is greater than 1, the value needs to be hashed before it can be processed, option 'hashValue' must be set to true`
        );
      }

      valueField = valueFields[0];
      if (valueField.equals(CP_PADD_VALUE).toBoolean()) {
        throw new Error(
          `Value cannot be a reserved value for padding: ${CP_PADD_VALUE.toString()}`
        );
      }
    }

    let { hash: currentHash, value: currentData } = this.th.digestLeaf(
      path,
      valueField
    );
    this.store.preparePutNodes(currentHash, currentData);

    const pathBits = path.toBits(this.depth());

    // Get the number of bits that the paths of the two leaf nodes share
    // in common as a prefix.
    let commonPrefixCount: number = 0;
    let oldValueHash: Field | null = null;
    if (pathNodes[0].equals(PLACEHOLDER).toBoolean()) {
      commonPrefixCount = this.depth();
    } else {
      let actualPath: Field;
      let result = this.th.parseLeaf(oldLeafData);
      actualPath = result.path;
      oldValueHash = result.leaf;

      commonPrefixCount = countCommonPrefix(
        pathBits,
        actualPath.toBits(this.depth())
      );
    }

    if (commonPrefixCount !== this.depth()) {
      if (pathBits[commonPrefixCount].toBoolean() === RIGHT) {
        const result = this.th.digestNode(pathNodes[0], currentHash);
        currentHash = result.hash;
        currentData = result.value;
      } else {
        const result = this.th.digestNode(currentHash, pathNodes[0]);
        currentHash = result.hash;
        currentData = result.value;
      }

      this.store.preparePutNodes(currentHash, currentData);
    } else if (oldValueHash !== null) {
      if (oldValueHash.equals(valueField).toBoolean()) {
        return this.root;
      }

      // remove old leaf
      this.store.prepareDelNodes(pathNodes[0]);
      this.store.prepareDelValue(path);
    }

    // console.log('commonPrefixCount: ', commonPrefixCount);

    // delete orphaned path nodes
    for (let i = 1; i < pathNodes.length; i++) {
      this.store.prepareDelNodes(pathNodes[i]);
    }

    // i-offsetOfSideNodes is the index into sideNodes[]
    let offsetOfSideNodes = this.depth() - sideNodes.length;
    for (let i = 0; i < this.depth(); i++) {
      let sideNode: Field;
      const offset = i - offsetOfSideNodes;

      if (offset < 0 || offset >= sideNodes.length) {
        if (
          commonPrefixCount != this.depth() &&
          commonPrefixCount > this.depth() - 1 - i
        ) {
          sideNode = PLACEHOLDER;
        } else {
          continue;
        }
      } else {
        sideNode = sideNodes[offset];
      }

      if (pathBits[this.depth() - 1 - i].toBoolean() === RIGHT) {
        const result = this.th.digestNode(sideNode, currentHash);
        currentHash = result.hash;
        currentData = result.value;
      } else {
        const result = this.th.digestNode(currentHash, sideNode);
        currentHash = result.hash;
        currentData = result.value;
      }

      this.store.preparePutNodes(currentHash, currentData);
    }

    this.store.preparePutValue(path, value);
    return currentHash;
  }

  private async deleteWithSideNodes(
    path: Field,
    sideNodes: Field[],
    pathNodes: Field[],
    oldLeafData: Field[]
  ): Promise<Field> {
    if (pathNodes[0].equals(PLACEHOLDER).toBoolean()) {
      throw new Error(ERR_KEY_ALREADY_EMPTY);
    }

    const actualPath = this.th.parseLeaf(oldLeafData).path;
    if (path.equals(actualPath).not().toBoolean()) {
      throw new Error(ERR_KEY_ALREADY_EMPTY);
    }
    const pathBits = path.toBits(this.depth());
    // All nodes above the deleted leaf are now orphaned
    pathNodes.forEach((node) => {
      this.store.prepareDelNodes(node);
    });

    let currentHash: Field = PLACEHOLDER; //set default value
    let currentData: Field[] | null = null;
    let nonPlaceholderReached = false;

    for (let i = 0; i < sideNodes.length; i++) {
      if (currentData === null) {
        let sideNodeValue = await this.store.getNodes(sideNodes[i]);
        if (this.th.isLeaf(sideNodeValue!)) {
          currentHash = sideNodes[i];
          continue;
        } else {
          // This is the node sibling that needs to be left in its place.
          currentHash = PLACEHOLDER;
          nonPlaceholderReached = true;
        }
      }

      if (
        !nonPlaceholderReached &&
        sideNodes[i].equals(PLACEHOLDER).toBoolean()
      ) {
        continue;
      } else if (!nonPlaceholderReached) {
        nonPlaceholderReached = true;
      }

      if (pathBits[sideNodes.length - 1 - i].toBoolean() === RIGHT) {
        let result = this.th.digestNode(sideNodes[i], currentHash);
        currentHash = result.hash;
        currentData = result.value;
      } else {
        let result = this.th.digestNode(currentHash, sideNodes[i]);
        currentHash = result.hash;
        currentData = result.value;
      }

      this.store.preparePutNodes(currentHash, currentData);
    }

    return currentHash;
  }

  private async sideNodesForRoot(
    path: Field,
    root: Field,
    getSiblingData: boolean
  ): Promise<{
    sideNodes: Field[];
    pathNodes: Field[];
    currentData: Field[] | null;
    siblingData: Field[] | null;
  }> {
    let sideNodes: Field[] = [];
    let pathNodes: Field[] = [];
    pathNodes.push(root);

    if (root.equals(PLACEHOLDER).toBoolean()) {
      return {
        sideNodes,
        pathNodes,
        currentData: null,
        siblingData: null,
      };
    }

    let currentData: Field[] | null = await this.store.getNodes(root);
    if (this.th.isLeaf(currentData)) {
      // The root is a leaf
      return {
        sideNodes,
        pathNodes,
        currentData,
        siblingData: null,
      };
    }

    let nodeHash: Field;
    let sideNode: Field | null = null;
    let siblingData: Field[] | null = null;
    let pathBits = path.toBits(this.depth());
    for (let i = 0; i < this.depth(); i++) {
      const { leftNode, rightNode } = this.th.parseNode(currentData!);
      if (pathBits[i].toBoolean() === RIGHT) {
        sideNode = leftNode;
        nodeHash = rightNode;
      } else {
        sideNode = rightNode;
        nodeHash = leftNode;
      }

      sideNodes.push(sideNode);
      pathNodes.push(nodeHash);

      if (nodeHash.equals(PLACEHOLDER).toBoolean()) {
        // reached the end.
        currentData = null;
        break;
      }

      currentData = await this.store.getNodes(nodeHash);
      if (this.th.isLeaf(currentData)) {
        // The node is a leaf
        break;
      }
    }

    if (getSiblingData) {
      siblingData = await this.store.getNodes(sideNode!);
    }

    return {
      sideNodes: sideNodes.reverse(),
      pathNodes: pathNodes.reverse(),
      currentData,
      siblingData,
    };
  }
}
