import { Bool, CircuitValue, Field, isReady, Poseidon } from 'snarkyjs';

import { EMPTY_VALUE, RIGHT } from '../constant';
import { defaultNodes } from '../default_nodes';
import { FieldElements, Hasher } from '../model';
import { countSetBits, fieldToHexString, hexStringToField } from '../utils';
import { ProvableMerkleTreeUtils } from './verify_circuit';

await isReady;

export { BaseMerkleProof, MerkleTreeUtils };
export type { CompactMerkleProof, CompactMerkleProofJSON };

/**
 *  Merkle proof CircuitValue for an element in a MerkleTree.
 *
 * @export
 * @class BaseMerkleProof
 * @extends {CircuitValue}
 */
class BaseMerkleProof extends CircuitValue {
  static height: number;
  root: Field;
  sideNodes: Field[];

  height(): number {
    return (this.constructor as any).height;
  }

  constructor(root: Field, sideNodes: Field[]) {
    super();
    if (sideNodes.length !== this.height()) {
      throw Error(
        `The Length of sideNodes ${
          sideNodes.length
        } doesn't match static tree height ${this.height()}`
      );
    }

    this.root = root;
    this.sideNodes = sideNodes;
  }
}

/**
 * Compacted Merkle proof for an element in a MerkleTree
 *
 * @export
 * @interface CompactMerkleProof
 */
interface CompactMerkleProof {
  height: number;
  root: Field;
  sideNodes: Field[];
  bitMask: Field;
}

/**
 * A type used to support serialization to json for CompactMerkleProof.
 *
 * @export
 * @interface CompactMerkleProofJSON
 */
interface CompactMerkleProofJSON {
  height: number;
  root: string;
  sideNodes: string[];
  bitMask: string;
}

class MerkleTreeUtils {
  /**
   * Compact a merkle proof to reduce its size
   *
   * @export
   * @param {BaseMerkleProof} proof
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {CompactMerkleProof}
   */
  static compactMerkleProof(
    proof: BaseMerkleProof,
    hasher: Hasher = Poseidon.hash
  ): CompactMerkleProof {
    const h = proof.height();
    if (proof.sideNodes.length !== h) {
      throw new Error('Bad proof size');
    }

    let bits = new Array<Bool>(h).fill(new Bool(false));
    let compactSideNodes: Field[] = [];
    for (let i = 0; i < h; i++) {
      let node = proof.sideNodes[i];
      if (node.equals(defaultNodes(hasher, h)[i + 1]).toBoolean()) {
        bits[i] = new Bool(true);
      } else {
        compactSideNodes.push(node);
      }
    }

    return {
      height: h,
      root: proof.root,
      sideNodes: compactSideNodes,
      bitMask: Field.ofBits(bits),
    };
  }

  /**
   * Decompact a CompactMerkleProof.
   *
   * @export
   * @param {CompactMerkleProof} proof
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {BaseMerkleProof}
   */
  static decompactMerkleProof(
    proof: CompactMerkleProof,
    hasher: Hasher = Poseidon.hash
  ): BaseMerkleProof {
    const h = proof.height;
    const bits = proof.bitMask.toBits();
    const proofSize = h - countSetBits(bits);
    if (proof.sideNodes.length !== proofSize) {
      throw new Error('Invalid proof size');
    }

    let decompactedSideNodes = new Array<Field>(h);
    let position = 0;
    for (let i = 0; i < h; i++) {
      if (bits[i].toBoolean()) {
        decompactedSideNodes[i] = defaultNodes(hasher, h)[i + 1];
      } else {
        decompactedSideNodes[i] = proof.sideNodes[position];
        position++;
      }
    }

    class MerkleProof_ extends ProvableMerkleTreeUtils.MerkleProof(h) {}

    return new MerkleProof_(proof.root, decompactedSideNodes);
  }

  /**
   * Convert CompactMerkleProof to JSONValue.
   *
   * @export
   * @param {CompactMerkleProof} proof
   * @return {*}  {CompactMerkleProofJSON}
   */
  static compactMerkleProofToJson(
    proof: CompactMerkleProof
  ): CompactMerkleProofJSON {
    let sideNodesStrArr = proof.sideNodes.map((v) => fieldToHexString(v));

    return {
      height: proof.height,
      root: fieldToHexString(proof.root),
      sideNodes: sideNodesStrArr,
      bitMask: fieldToHexString(proof.bitMask),
    };
  }

  /**
   * Convert JSONValue to CompactMerkleProof
   *
   * @export
   * @param {CompactMerkleProofJSON} jsonValue
   * @return {*}  {CompactMerkleProof}
   */
  static jsonToCompactMerkleProof(
    jsonValue: CompactMerkleProofJSON
  ): CompactMerkleProof {
    let sideNodes = jsonValue.sideNodes.map((v) => hexStringToField(v));

    return {
      height: jsonValue.height,
      root: hexStringToField(jsonValue.root),
      sideNodes,
      bitMask: hexStringToField(jsonValue.bitMask),
    };
  }

  /**
   * Calculate new root based on value. Note: This method cannot be executed in a circuit.
   *
   * @template V
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashValue: true,
   *     }]
   * @return {*}  {Field}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  static computeRoot<V extends FieldElements>(
    proof: BaseMerkleProof,
    index: bigint,
    value?: V,
    options: { hasher: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): Field {
    let currentHash: Field;
    if (value !== undefined) {
      if (options.hashValue) {
        currentHash = options.hasher(value.toFields());
      } else {
        let fs = value.toFields();
        if (fs.length > 1) {
          throw new Error(
            `The length of value fields is greater than 1, the value needs to be hashed before it can be processed, option 'hashValue' must be set to true`
          );
        }

        currentHash = fs[0];
      }
    } else {
      currentHash = EMPTY_VALUE;
    }

    let h = proof.height();

    if (proof.sideNodes.length !== h) {
      throw new Error('Invalid sideNodes size');
    }

    const path = Field(index);
    const pathBits = path.toBits(h);
    for (let i = h - 1; i >= 0; i--) {
      let node = proof.sideNodes[i];
      if (pathBits[i].toBoolean() === RIGHT) {
        currentHash = options.hasher([node, currentHash]);
      } else {
        currentHash = options.hasher([currentHash, node]);
      }
    }

    return currentHash;
  }

  static checkMembership<V extends FieldElements>(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: bigint,
    value: V,
    options: { hasher: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): boolean {
    return this.verifyProof<V>(proof, expectedRoot, index, value, options);
  }

  static checkNonMembership<V extends FieldElements>(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: bigint,
    options: { hasher: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): boolean {
    return this.verifyProof<V>(proof, expectedRoot, index, undefined, options);
  }

  /**
   * Verify this merkle proof. Note: This method cannot be executed in a circuit.
   *
   * @template V
   * @param {Field} expectedRoot
   * @param {V} [value]
   * @param {{ hasher: Hasher; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashValue: true,
   *     }]
   * @return {*}  {boolean}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  static verifyProof<V extends FieldElements>(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: bigint,
    value?: V,
    options: { hasher: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): boolean {
    if (!proof.root.equals(expectedRoot).toBoolean()) {
      return false;
    }
    let currentRoot = this.computeRoot<V>(proof, index, value, options);

    return currentRoot.equals(expectedRoot).toBoolean();
  }

  static verifyProofByField(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: bigint,
    valueHashOrValueField: Field,
    hasher: Hasher = Poseidon.hash
  ): boolean {
    if (!proof.root.equals(expectedRoot).toBoolean()) {
      return false;
    }

    let currentRoot = this.computeRootByField(
      proof,
      index,
      valueHashOrValueField,
      hasher
    );

    return currentRoot.equals(expectedRoot).toBoolean();
  }

  static verifyProofByFieldWithUpdates(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: bigint,
    valueHashOrValueField: Field,
    hasher: Hasher = Poseidon.hash
  ): { ok: boolean; updates: [Field, Field[]][] } {
    if (!proof.root.equals(expectedRoot).toBoolean()) {
      return { ok: false, updates: [] };
    }

    let { actualRoot, updates } = this.computeRootByFieldWithUpdates(
      proof,
      index,
      valueHashOrValueField,
      hasher
    );

    return { ok: actualRoot.equals(expectedRoot).toBoolean(), updates };
  }

  static computeRootByField(
    proof: BaseMerkleProof,
    index: bigint,
    valueHashOrValueField: Field,
    hasher: Hasher = Poseidon.hash
  ): Field {
    let h = proof.height();
    let currentHash: Field = valueHashOrValueField;
    if (proof.sideNodes.length !== h) {
      throw new Error('Invalid proof');
    }

    const path = Field(index);
    const pathBits = path.toBits(h);
    for (let i = h - 1; i >= 0; i--) {
      let node = proof.sideNodes[i];
      let currentValue: Field[] = [];
      if (pathBits[i].toBoolean()) {
        currentValue = [node, currentHash];
      } else {
        currentValue = [currentHash, node];
      }
      currentHash = hasher(currentValue);
    }
    return currentHash;
  }

  static computeRootByFieldWithUpdates(
    proof: BaseMerkleProof,
    index: bigint,
    valueHashOrValueField: Field,
    hasher: Hasher = Poseidon.hash
  ): { actualRoot: Field; updates: [Field, Field[]][] } {
    let h = proof.height();
    let currentHash: Field = valueHashOrValueField;
    let updates: [Field, Field[]][] = [];
    updates.push([currentHash, [currentHash]]);

    const path = Field(index);
    const pathBits = path.toBits(h);
    for (let i = h - 1; i >= 0; i--) {
      let node = proof.sideNodes[i];
      let currentValue: Field[] = [];
      if (pathBits[i].toBoolean()) {
        currentValue = [node, currentHash];
      } else {
        currentValue = [currentHash, node];
      }
      currentHash = hasher(currentValue);
      updates.push([currentHash, currentValue]);
    }
    return { actualRoot: currentHash, updates };
  }
}
