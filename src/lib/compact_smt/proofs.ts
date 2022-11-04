import {
  arrayProp,
  Bool,
  CircuitValue,
  Field,
  isReady,
  Poseidon,
  prop,
} from 'snarkyjs';
import { RIGHT } from '../constant';
import { FieldElements, Hasher } from '../model';
import { CP_PADD_VALUE, CSMT_DEPTH, PLACEHOLDER } from './constant';
import { TreeHasher } from './tree_hasher';

await isReady;

export { CompactSparseMerkleProof, CSMTUtils };
export type { CSparseCompactMerkleProof };

/**
 * Proof for compact sparse merkle tree
 *
 * @class CompactSparseMerkleProof
 * @extends {CircuitValue}
 */
class CompactSparseMerkleProof extends CircuitValue {
  @arrayProp(Field, CSMT_DEPTH) sideNodes: Field[];
  @arrayProp(Field, 3) nonMembershipLeafData: Field[];
  @arrayProp(Field, 3) siblingData: Field[];
  @prop root: Field;

  constructor(
    sideNodes: Field[],
    nonMembershipLeafData: Field[],
    siblingData: Field[],
    root: Field
  ) {
    super();
    let len = sideNodes.length;
    if (len > CSMT_DEPTH) {
      throw new Error(
        `The length of sideNodes cannot be greater than ${CSMT_DEPTH}`
      );
    }

    // padd with CP_PADD_VALUE to a fixed length
    sideNodes = sideNodes.concat(Array(CSMT_DEPTH - len).fill(CP_PADD_VALUE));

    this.sideNodes = sideNodes;
    this.nonMembershipLeafData = nonMembershipLeafData;
    this.siblingData = siblingData;
    this.root = root;
  }
}

/**
 * SparseCompactMerkleProof for compact sparse merkle tree
 *
 * @interface CSparseCompactMerkleProof
 */
interface CSparseCompactMerkleProof {
  sideNodes: Field[];
  nonMembershipLeafData: Field[];
  bitMask: Field;
  numSideNodes: number;
  siblingData: Field[];
  root: Field;
}

/**
 * Collection of utility functions for compact sparse merkle tree
 *
 * @class CSMTUtils
 */
class CSMTUtils {
  /**
   * Verify Compact Proof for Compact Sparse Merkle Tree
   *
   * @static
   * @template K
   * @template V
   * @param {CSparseCompactMerkleProof} cproof
   * @param {Field} expectedRoot
   * @param {K} key
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashKey: boolean; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash; hashKey:
   * whether to hash the key, the default is true; hashValue: whether to hash the value,
   * the default is true.
   * @return {*}  {boolean}
   * @memberof CSMTUtils
   */
  static verifyCompactProof<K extends FieldElements, V extends FieldElements>(
    cproof: CSparseCompactMerkleProof,
    expectedRoot: Field,
    key: K,
    value?: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): boolean {
    const proof = this.decompactProof(cproof, options.hasher);
    return this.verifyProof<K, V>(proof, expectedRoot, key, value, options);
  }

  /**
   * Verify a merkle proof, return result and updates.
   *
   * @static
   * @template K
   * @template V
   * @param {CompactSparseMerkleProof} proof
   * @param {Field} expectedRoot
   * @param {K} key
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashKey: boolean; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash; hashKey:
   * whether to hash the key, the default is true; hashValue: whether to hash the value,
   * the default is true.
   * @return {*}  {({
   *     ok: boolean;
   *     updates: [Field, Field[]][] | null;
   *   })}
   * @memberof CSMTUtils
   */
  static verifyProofWithUpdates<
    K extends FieldElements,
    V extends FieldElements
  >(
    proof: CompactSparseMerkleProof,
    expectedRoot: Field,
    key: K,
    value?: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): {
    ok: boolean;
    updates: [Field, Field[]][] | null;
  } {
    const th = new TreeHasher(options.hasher);

    let path = null;
    if (options.hashKey) {
      path = th.path(key);
    } else {
      let keyFields = key.toFields();
      if (keyFields.length > 1) {
        throw new Error(
          `The length of key fields is greater than 1, the key needs to be hashed before it can be processed, option 'hashKey' must be set to true`
        );
      }
      path = keyFields[0];
    }

    let updates: [Field, Field[]][] = [];
    let currentHash: Field;
    let currentData: Field[];
    if (value === undefined) {
      //Non-membership proof
      if (th.isEmptyData(proof.nonMembershipLeafData)) {
        currentHash = PLACEHOLDER;
      } else {
        const { path: actualPath, leaf: valueField } = th.parseLeaf(
          proof.nonMembershipLeafData
        );
        if (actualPath.equals(path).toBoolean()) {
          return {
            ok: false,
            updates: null,
          };
        }
        const result = th.digestLeaf(actualPath, valueField);
        currentHash = result.hash;
        currentData = result.value;
        let update: [Field, Field[]] = [currentHash, currentData];
        updates.push(update);
      }
    } else {
      // Membership proof
      let valueField = null;
      if (options.hashValue) {
        valueField = th.digest(value);
      } else {
        let valueFields = value.toFields();
        if (valueFields.length > 1) {
          throw new Error(
            `The length of value fields is greater than 1, the value needs to be hashed before it can be processed, option 'hashValue' must be set to true`
          );
        }

        valueField = valueFields[0];
      }

      const result = th.digestLeaf(path, valueField);
      currentHash = result.hash;
      currentData = result.value;
      const update: [Field, Field[]] = [currentHash, currentData];
      updates.push(update);
    }

    let realSideNodesLength = 0;
    for (
      let i = 0, sideNodesLength = proof.sideNodes.length;
      i < sideNodesLength;
      i++
    ) {
      if (proof.sideNodes[i].equals(CP_PADD_VALUE).toBoolean()) {
        break;
      }
      realSideNodesLength++;
    }

    const pathBits = path.toBits(CSMT_DEPTH);
    //Recompute root
    for (let i = 0; i < realSideNodesLength; i++) {
      let node = proof.sideNodes[i];

      if (node.equals(CP_PADD_VALUE).toBoolean()) {
        break;
      }

      if (pathBits[realSideNodesLength - 1 - i].toBoolean() === RIGHT) {
        const result = th.digestNode(node, currentHash);
        currentHash = result.hash;
        currentData = result.value;
      } else {
        const result = th.digestNode(currentHash, node);
        currentHash = result.hash;
        currentData = result.value;
      }

      const update: [Field, Field[]] = [currentHash, currentData];
      updates.push(update);
    }

    return {
      ok: currentHash.equals(expectedRoot).toBoolean(),
      updates,
    };
  }

  /**
   * Returns true if the value is in the tree and it is at the index from the key
   *
   * @static
   * @template K
   * @template V
   * @param {CompactSparseMerkleProof} proof
   * @param {Field} expectedRoot
   * @param {K} key
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashKey: boolean; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash; hashKey:
   * whether to hash the key, the default is true; hashValue: whether to hash the value,
   * the default is true.
   * @return {*}  {boolean}
   * @memberof CSMTUtils
   */
  static checkMemebership<K extends FieldElements, V extends FieldElements>(
    proof: CompactSparseMerkleProof,
    expectedRoot: Field,
    key: K,
    value?: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): boolean {
    return this.verifyProof<K, V>(proof, expectedRoot, key, value, options);
  }

  /**
   * Returns true if there is no value at the index from the key
   *
   * @static
   * @template K
   * @template V
   * @param {CompactSparseMerkleProof} proof
   * @param {Field} expectedRoot
   * @param {K} key
   * @param {{ hasher: Hasher; hashKey: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash;
   * hashKey: whether to hash the key, the default is true
   * @return {*}  {boolean}
   * @memberof CSMTUtils
   */
  static checkNonMemebership<K extends FieldElements, V extends FieldElements>(
    proof: CompactSparseMerkleProof,
    expectedRoot: Field,
    key: K,
    options: { hasher: Hasher; hashKey: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
    }
  ): boolean {
    return this.verifyProof<K, V>(proof, expectedRoot, key, undefined, {
      hasher: options.hasher,
      hashKey: options.hashKey,
      hashValue: true,
    });
  }

  /**
   * Verify Proof of Compact Sparse Merkle Tree
   *
   * @static
   * @template K
   * @template V
   * @param {CompactSparseMerkleProof} proof
   * @param {Field} root
   * @param {K} key
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashKey: boolean; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashKey: true,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash; hashKey:
   * whether to hash the key, the default is true; hashValue: whether to hash the value,
   * the default is true.
   * @return {*}  {boolean}
   * @memberof CSMTUtils
   */
  static verifyProof<K extends FieldElements, V extends FieldElements>(
    proof: CompactSparseMerkleProof,
    root: Field,
    key: K,
    value?: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): boolean {
    const { ok } = this.verifyProofWithUpdates<K, V>(
      proof,
      root,
      key,
      value,
      options
    );
    return ok;
  }

  /**
   * Compact proof Of Compact Sparse Merkle Tree
   *
   * @static
   * @param {CompactSparseMerkleProof} proof
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {CSparseCompactMerkleProof}
   * @memberof CSMTUtils
   */
  static compactProof(
    proof: CompactSparseMerkleProof,
    hasher: Hasher = Poseidon.hash
  ): CSparseCompactMerkleProof {
    const sideNodes = proof.sideNodes;
    const sideNodesLength = sideNodes.length;
    let bits = Array<Bool>(CSMT_DEPTH).fill(Bool(false));

    let compactedSideNodes = [];
    let oriSideNodesLength = 0;
    for (let i = 0; i < sideNodesLength; i++) {
      if (sideNodes[i].equals(CP_PADD_VALUE).toBoolean()) {
        break;
      }

      oriSideNodesLength++;
      if (sideNodes[i].equals(PLACEHOLDER).toBoolean()) {
        bits[i] = Bool(true);
      } else {
        compactedSideNodes.push(sideNodes[i]);
      }
    }

    return {
      sideNodes: compactedSideNodes,
      nonMembershipLeafData: proof.nonMembershipLeafData,
      bitMask: Field.ofBits(bits),
      numSideNodes: oriSideNodesLength,
      siblingData: proof.siblingData,
      root: proof.root,
    };
  }

  /**
   * Decompact compact proof of Compact Sparse Merkle Tree
   *
   * @static
   * @param {CSparseCompactMerkleProof} proof
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {CompactSparseMerkleProof}
   * @memberof CSMTUtils
   */
  static decompactProof(
    proof: CSparseCompactMerkleProof,
    hasher: Hasher = Poseidon.hash
  ): CompactSparseMerkleProof {
    let decompactedSideNodes = [];
    let position = 0;

    const bits = proof.bitMask.toBits();
    for (let i = 0; i < proof.numSideNodes; i++) {
      if (bits[i].toBoolean()) {
        decompactedSideNodes[i] = PLACEHOLDER;
      } else {
        decompactedSideNodes[i] = proof.sideNodes[position];
        position++;
      }
    }

    return new CompactSparseMerkleProof(
      decompactedSideNodes,
      proof.nonMembershipLeafData,
      proof.siblingData,
      proof.root
    );
  }
}
