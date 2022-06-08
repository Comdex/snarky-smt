import { Field, Poseidon } from 'snarkyjs';
import { ERR_KEY_ALREADY_EMPTY, RIGHT, SMT_DEPTH } from '../constant';
import { FieldElements, Optional } from '../model';
import { Hasher } from '../proofs';
import { Store } from '../store/store';
import { countCommonPrefix } from '../utils';
import {
  compactProof_C,
  CSparseCompactMerkleProof,
  CSparseMerkleProof,
  NonMembershipLeafData,
  SiblingData,
} from './proofs';
import { TreeHasher } from './tree_hasher';

/**
 * CompactSparseMerkleTree
 *
 * @export
 * @class CSparseMerkleTree
 * @template K
 * @template V
 */
export class CSparseMerkleTree<
  K extends FieldElements,
  V extends FieldElements
> {
  protected th: TreeHasher<K, V>;
  protected store: Store<V>;
  protected root: Field;

  /**
   * Creates an instance of CSparseMerkleTree.
   * @param {Store<V>} store
   * @param {Field} [root]
   * @param {Hasher} [hasher=Poseidon.hash]
   * @memberof CSparseMerkleTree
   */
  constructor(store: Store<V>, root?: Field, hasher: Hasher = Poseidon.hash) {
    this.th = new TreeHasher<K, V>(hasher);
    this.store = store;
    if (root) {
      this.root = root;
    } else {
      this.root = this.th.placeholder();
    }
  }

  /**
   * Build a new compacted sparse merkle tree
   *
   * @static
   * @template K
   * @template V
   * @param {Store<V>} store
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Promise<CSparseMerkleTree<K, V>>}
   * @memberof CSparseMerkleTree
   */
  public static async importTree<
    K extends FieldElements,
    V extends FieldElements
  >(
    store: Store<V>,
    hasher: Hasher = Poseidon.hash
  ): Promise<CSparseMerkleTree<K, V>> {
    const root = await store.getRoot();
    if (root === null) {
      throw new Error('Root does not exist in store');
    }
    return new CSparseMerkleTree(store, root!, hasher);
  }

  /**
   * Get the root of the tree.
   *
   * @return {*}  {Field}
   * @memberof CSparseMerkleTree
   */
  public getRoot(): Field {
    return this.root;
  }

  /**
   * Get the tree hasher used by the tree.
   *
   * @return {*}  {TreeHasher<K, V>}
   * @memberof CSparseMerkleTree
   */
  public getTreeHasher(): TreeHasher<K, V> {
    return this.th;
  }

  /**
   * Get the data store of the tree.
   *
   * @return {*}  {Store<V>}
   * @memberof CSparseMerkleTree
   */
  public getStore(): Store<V> {
    return this.store;
  }

  /**
   * Set the root of the tree.
   *
   * @param {Field} root
   * @return {*}  {Promise<void>}
   * @memberof CSparseMerkleTree
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
   * @memberof CSparseMerkleTree
   */
  public depth(): number {
    return SMT_DEPTH;
  }

  /**
   * Clear the tree.
   *
   * @return {*}  {Promise<void>}
   * @memberof CSparseMerkleTree
   */
  public async clear(): Promise<void> {
    await this.store.clear();
  }

  /**
   * Get the value for a key from the tree.
   *
   * @param {K} key
   * @return {*}  {(Promise<V | null>)}
   * @memberof CSparseMerkleTree
   */
  public async get(key: K): Promise<V | null> {
    if (this.root.equals(this.th.placeholder()).toBoolean()) {
      throw new Error('Key does not exist');
    }

    const path = this.th.path(key);
    return await this.store.getValue(path);
  }

  /**
   * Check if the key exists in the tree.
   *
   * @param {K} key
   * @return {*}  {Promise<boolean>}
   * @memberof CSparseMerkleTree
   */
  public async has(key: K): Promise<boolean> {
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
   * @memberof CSparseMerkleTree
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
   * @memberof CSparseMerkleTree
   */
  public async updateAll(kvs: { key: K; value?: V }[]): Promise<Field> {
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
   * @memberof CSparseMerkleTree
   */
  public async delete(key: K): Promise<Field> {
    return this.update(key);
  }

  /**
   * Create a merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<CSparseMerkleProof>}
   * @memberof CSparseMerkleTree
   */
  public async prove(key: K): Promise<CSparseMerkleProof> {
    return await this.doProveForRoot(this.root, key, false);
  }

  /**
   * Create an updatable Merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<CSparseMerkleProof>}
   * @memberof CSparseMerkleTree
   */
  public async proveUpdatable(key: K): Promise<CSparseMerkleProof> {
    return await this.doProveForRoot(this.root, key, true);
  }

  /**
   * Create a compacted merkle proof for a key against the current root.
   *
   * @param {K} key
   * @return {*}  {Promise<CSparseCompactMerkleProof>}
   * @memberof CSparseMerkleTree
   */
  public async proveCompact(key: K): Promise<CSparseCompactMerkleProof> {
    return await this.proveCompactForRoot(this.root, key);
  }

  protected async proveCompactForRoot(
    root: Field,
    key: K
  ): Promise<CSparseCompactMerkleProof> {
    const proof = await this.doProveForRoot(root, key, false);
    return compactProof_C(proof, this.th.getHasher());
  }

  protected async doProveForRoot(
    root: Field,
    key: K,
    isUpdatable: boolean
  ): Promise<CSparseMerkleProof> {
    const path = this.th.path(key);

    let {
      sideNodes,
      pathNodes,
      currentData: leafData,
      siblingData,
    } = await this.sideNodesForRoot(path, root, isUpdatable);

    let nonMembershipLeafData = Optional.empty<NonMembershipLeafData>(
      NonMembershipLeafData
    ); // set default empty data

    if (pathNodes[0].equals(this.th.placeholder()).not().toBoolean()) {
      const { path: actualPath } = this.th.parseLeaf(leafData!);
      if (actualPath.equals(path).not().toBoolean()) {
        nonMembershipLeafData = Optional.of<NonMembershipLeafData>(
          new NonMembershipLeafData(leafData!)
        );
      }
    }

    let siblingDataObj = Optional.empty<SiblingData>(SiblingData);
    if (siblingData !== null) {
      siblingDataObj = Optional.of<SiblingData>(new SiblingData(siblingData));
    }

    return new CSparseMerkleProof(
      sideNodes,
      nonMembershipLeafData,
      siblingDataObj
    );
  }

  protected async updateForRoot(
    root: Field,
    key: K,
    value?: V
  ): Promise<Field> {
    const path = this.th.path(key);

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

  protected async deleteWithSideNodes(
    path: Field,
    sideNodes: Field[],
    pathNodes: Field[],
    oldLeafData: Field[]
  ): Promise<Field> {
    if (pathNodes[0].equals(this.th.placeholder()).toBoolean()) {
      throw new Error(ERR_KEY_ALREADY_EMPTY);
    }

    const actualPath = this.th.parseLeaf(oldLeafData).path;
    if (path.equals(actualPath).not().toBoolean()) {
      throw new Error(ERR_KEY_ALREADY_EMPTY);
    }
    const pathBits = path.toBits();
    // All nodes above the deleted leaf are now orphaned
    pathNodes.forEach((node) => {
      this.store.prepareDelNodes(node);
    });

    let currentHash: Field = this.th.placeholder(); //set default value
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
          currentHash = this.th.placeholder();
          nonPlaceholderReached = true;
        }
      }

      if (
        !nonPlaceholderReached &&
        sideNodes[i].equals(this.th.placeholder()).toBoolean()
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

  protected updateWithSideNodes(
    path: Field,
    value: V,
    sideNodes: Field[],
    pathNodes: Field[],
    oldLeafData: Field[]
  ): Field {
    const valueHash = this.th.digest(value);
    let { hash: currentHash, value: currentData } = this.th.digestLeaf(
      path,
      valueHash
    );
    this.store.preparePutNodes(currentHash, currentData);

    const pathBits = path.toBits();
    // Get the number of bits that the paths of the two leaf nodes share
    // in common as a prefix.
    let commonPrefixCount: number = 0;
    let oldValueHash: Field | null = null;
    if (pathNodes[0].equals(this.th.placeholder()).toBoolean()) {
      commonPrefixCount = this.depth();
    } else {
      let actualPath: Field;
      let result = this.th.parseLeaf(oldLeafData);
      actualPath = result.path;
      oldValueHash = result.leaf;
      commonPrefixCount = countCommonPrefix(pathBits, actualPath.toBits());
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
      if (oldValueHash.equals(valueHash).toBoolean()) {
        return this.root;
      }

      // remove old leaf
      this.store.prepareDelNodes(pathNodes[0]);
      this.store.prepareDelValue(path);
    }

    console.log('commonPrefixCount: ', commonPrefixCount);

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
          sideNode = this.th.placeholder();
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

  protected async sideNodesForRoot(
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

    if (root.equals(this.th.placeholder()).toBoolean()) {
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
    let pathBits = path.toBits();
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

      if (nodeHash.equals(this.th.placeholder()).toBoolean()) {
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
