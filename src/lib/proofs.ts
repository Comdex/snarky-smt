import {
  arrayProp,
  Bool,
  CircuitValue,
  Field,
  isReady,
  Poseidon,
  prop,
} from 'snarkyjs';
import { RIGHT, SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import { defaultNodes } from './default_nodes';
import { FieldElements } from './model';
import { countSetBits } from './utils';

export type Hasher = (v: Field[]) => Field;

await isReady;

/**
 * Merkle proof CircuitValue for an element in a SparseMerkleTree.
 *
 * @export
 * @class SparseMerkleProof
 * @extends {CircuitValue}
 */
export class SparseMerkleProof extends CircuitValue {
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
export interface SparseCompactMerkleProof {
  sideNodes: Field[];
  bitMask: Field;
  root: Field;
}

/**
 * Calculate new root based on sideNodes, key and value
 *
 * @export
 * @template K
 * @template V
 * @param {Field[]} sideNodes
 * @param {K} key
 * @param {V} [value]
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Field}
 */
export function computeRoot<K extends FieldElements, V extends FieldElements>(
  sideNodes: Field[],
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): Field {
  let currentHash: Field;
  if (value !== undefined) {
    currentHash = hasher(value.toFields());
  } else {
    currentHash = SMT_EMPTY_VALUE;
  }

  if (sideNodes.length !== SMT_DEPTH) {
    throw new Error('Invalid sideNodes size');
  }

  const path = hasher(key.toFields());
  const pathBits = path.toBits();
  for (let i = SMT_DEPTH - 1; i >= 0; i--) {
    let node = sideNodes[i];
    if (pathBits[i].toBoolean() === RIGHT) {
      currentHash = hasher([node, currentHash]);
    } else {
      currentHash = hasher([currentHash, node]);
    }
  }

  return currentHash;
}

/**
 * Verify a merkle proof
 *
 * @export
 * @template K
 * @template V
 * @param {SparseMerkleProof} proof
 * @param {Field} root
 * @param {K} key
 * @param {V} [value]
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {boolean}
 */
export function verifyProof<K extends FieldElements, V extends FieldElements>(
  proof: SparseMerkleProof,
  root: Field,
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): boolean {
  if (proof.root.equals(root).not().toBoolean()) {
    return false;
  }
  let newRoot = computeRoot<K, V>(proof.sideNodes, key, value, hasher);

  return newRoot.equals(root).toBoolean();
}

/**
 * Verify a compacted merkle proof
 *
 * @export
 * @template K
 * @template V
 * @param {SparseCompactMerkleProof} cproof
 * @param {Field} root
 * @param {K} key
 * @param {V} [value]
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {boolean}
 */
export function verifyCompactProof<
  K extends FieldElements,
  V extends FieldElements
>(
  cproof: SparseCompactMerkleProof,
  root: Field,
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): boolean {
  const proof = decompactProof(cproof, hasher);
  return verifyProof(proof, root, key, value, hasher);
}

/**
 * Compact a proof to reduce its size
 *
 * @export
 * @param {SparseMerkleProof} proof
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {SparseCompactMerkleProof}
 */
export function compactProof(
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
export function decompactProof(
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
