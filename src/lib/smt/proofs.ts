import { arrayProp, Bool, CircuitValue, Field, Poseidon, prop } from 'snarkyjs';
import { EMPTY_VALUE, RIGHT, SMT_DEPTH } from '../constant';
import { defaultNodes } from '../default_nodes';
import { FieldElements, Hasher } from '../model';
import { countSetBits, fieldToHexString, hexStringToField } from '../utils';

export { SparseMerkleProof, SMTUtils };
export type { SparseCompactMerkleProof, SparseCompactMerkleProofJSON };

/**
 * Merkle proof CircuitValue for an element in a SparseMerkleTree.
 *
 * @export
 * @class SparseMerkleProof
 * @extends {CircuitValue}
 */
class SparseMerkleProof extends CircuitValue {
  @arrayProp(Field, SMT_DEPTH) sideNodes: Field[];
  @prop root: Field;

  constructor(sideNodes: Field[], root: Field) {
    super(sideNodes, root);
    this.sideNodes = sideNodes;
    this.root = root;
  }
}

/**
 * Compacted Merkle proof for an element in a SparseMerkleTree
 *
 * @export
 * @interface SparseCompactMerkleProof
 */
interface SparseCompactMerkleProof {
  sideNodes: Field[];
  bitMask: Field;
  root: Field;
}

// A type used to support serialization to json for SparseCompactMerkleProof.
interface SparseCompactMerkleProofJSON {
  sideNodes: string[];
  bitMask: string;
  root: string;
}

class SMTUtils {
  /**
   * Convert SparseCompactMerkleProof to JSONValue.
   *
   * @export
   * @param {SparseCompactMerkleProof} proof
   * @return {*}  {SparseCompactMerkleProofJSONValue}
   */
  static sparseCompactMerkleProofToJson(
    proof: SparseCompactMerkleProof
  ): SparseCompactMerkleProofJSON {
    let sideNodesStrArr: string[] = [];
    proof.sideNodes.forEach((v) => {
      const str = fieldToHexString(v);
      sideNodesStrArr.push(str);
    });

    return {
      sideNodes: sideNodesStrArr,
      bitMask: fieldToHexString(proof.bitMask),
      root: fieldToHexString(proof.root),
    };
  }

  /**
   * Convert JSONValue to SparseCompactMerkleProof
   *
   * @export
   * @param {SparseCompactMerkleProofJSONValue} jsonValue
   * @return {*}  {SparseCompactMerkleProof}
   */
  static jsonToSparseCompactMerkleProof(
    jsonValue: SparseCompactMerkleProofJSON
  ): SparseCompactMerkleProof {
    let sideNodes: Field[] = [];
    jsonValue.sideNodes.forEach((v) => {
      const f = hexStringToField(v);
      sideNodes.push(f);
    });

    return {
      sideNodes,
      bitMask: hexStringToField(jsonValue.bitMask),
      root: hexStringToField(jsonValue.root),
    };
  }

  /**
   * Calculate new root based on sideNodes, key and value
   *
   * @template K
   * @template V
   * @param {Field[]} sideNodes
   * @param {K} key
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashKey: boolean; hashValue: boolean }} [options={
   *     hasher: Poseidon.hash,
   *     hashKey: true,
   *     hashValue: true,
   *   }]
   * @return {*}  {Field}
   */
  static computeRoot<K extends FieldElements, V extends FieldElements>(
    sideNodes: Field[],
    key: K,
    value?: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): Field {
    let currentHash: Field;
    if (value !== undefined) {
      let valueFields = value.toFields();
      if (options.hashValue) {
        currentHash = options.hasher(valueFields);
      } else {
        currentHash = valueFields[0];
      }
    } else {
      currentHash = EMPTY_VALUE;
    }

    if (sideNodes.length !== SMT_DEPTH) {
      throw new Error('Invalid sideNodes size');
    }

    let path = null;
    let keyFields = key.toFields();
    if (options.hashKey) {
      path = options.hasher(keyFields);
    } else {
      path = keyFields[0];
    }

    const pathBits = path.toBits();
    for (let i = SMT_DEPTH - 1; i >= 0; i--) {
      let node = sideNodes[i];
      if (pathBits[i].toBoolean() === RIGHT) {
        currentHash = options.hasher([node, currentHash]);
      } else {
        currentHash = options.hasher([currentHash, node]);
      }
    }

    return currentHash;
  }

  static checkMembership<K extends FieldElements, V extends FieldElements>(
    proof: SparseMerkleProof,
    expectedRoot: Field,
    key: K,
    value: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): boolean {
    return this.verifyProof<K, V>(proof, expectedRoot, key, value, options);
  }

  static checkNonMembership<K extends FieldElements, V extends FieldElements>(
    proof: SparseMerkleProof,
    expectedRoot: Field,
    key: K,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): boolean {
    return this.verifyProof<K, V>(proof, expectedRoot, key, undefined, options);
  }

  /**
   * Verify a merkle proof
   *
   * @template K
   * @template V
   * @param {SparseMerkleProof} proof
   * @param {Field} expectedRoot
   * @param {K} key
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashKey: boolean; hashValue: boolean }} [options={
   *     hasher: Poseidon.hash,
   *     hashKey: true,
   *     hashValue: true,
   *   }]
   * @return {*}  {boolean}
   */
  static verifyProof<K extends FieldElements, V extends FieldElements>(
    proof: SparseMerkleProof,
    expectedRoot: Field,
    key: K,
    value?: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): boolean {
    if (!proof.root.equals(expectedRoot).toBoolean()) {
      return false;
    }
    let newRoot = this.computeRoot<K, V>(proof.sideNodes, key, value, options);

    return newRoot.equals(expectedRoot).toBoolean();
  }

  /**
   * Verify a compacted merkle proof
   *
   * @template K
   * @template V
   * @param {SparseCompactMerkleProof} cproof
   * @param {Field} expectedRoot
   * @param {K} key
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashKey: boolean; hashValue: boolean }} [options={
   *     hasher: Poseidon.hash,
   *     hashKey: true,
   *     hashValue: true,
   *   }]
   * @return {*}  {boolean}
   */
  static verifyCompactProof<K extends FieldElements, V extends FieldElements>(
    cproof: SparseCompactMerkleProof,
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
    return this.verifyProof(proof, expectedRoot, key, value, options);
  }

  /**
   * Compact a proof to reduce its size
   *
   * @export
   * @param {SparseMerkleProof} proof
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {SparseCompactMerkleProof}
   */
  static compactProof(
    proof: SparseMerkleProof,
    hasher: Hasher = Poseidon.hash
  ): SparseCompactMerkleProof {
    if (proof.sideNodes.length !== SMT_DEPTH) {
      throw new Error('Bad proof size');
    }

    let bits = new Array<Bool>(SMT_DEPTH).fill(new Bool(false));
    let compactSideNodes: Field[] = [];
    for (let i = 0; i < SMT_DEPTH; i++) {
      let node = proof.sideNodes[i];
      if (node.equals(defaultNodes(hasher)[i + 1]).toBoolean()) {
        bits[i] = new Bool(true);
      } else {
        compactSideNodes.push(node);
      }
    }

    return {
      sideNodes: compactSideNodes,
      bitMask: Field.ofBits(bits),
      root: proof.root,
    };
  }

  /**
   * Decompact a proof
   *
   * @export
   * @param {SparseCompactMerkleProof} proof
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {SparseMerkleProof}
   */
  static decompactProof(
    proof: SparseCompactMerkleProof,
    hasher: Hasher = Poseidon.hash
  ): SparseMerkleProof {
    const bits = proof.bitMask.toBits();
    const proofSize = SMT_DEPTH - countSetBits(bits);
    if (proof.sideNodes.length !== proofSize) {
      throw new Error('Invalid proof size');
    }

    let decompactedSideNodes = new Array<Field>(SMT_DEPTH);
    let position = 0;
    for (let i = 0; i < SMT_DEPTH; i++) {
      if (bits[i].toBoolean()) {
        decompactedSideNodes[i] = defaultNodes(hasher)[i + 1];
      } else {
        decompactedSideNodes[i] = proof.sideNodes[position];
        position++;
      }
    }

    return new SparseMerkleProof(decompactedSideNodes, proof.root);
  }
}
