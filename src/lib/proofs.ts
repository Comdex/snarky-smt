import {
  arrayProp,
  AsFieldElements,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  isReady,
  Poseidon,
  prop,
} from 'snarkyjs';
import { RIGHT, SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import { defaultNodes } from './default_nodes';
import { FieldElements } from './model';
import { countSetBits, createEmptyValue } from './utils';

await isReady;

export type Hasher = (v: Field[]) => Field;

/**
 *  Merkle proof CircuitValue for an element in a NumIndexSparseMerkleTree.
 *
 * @export
 * @class BaseNumIndexSparseMerkleProof
 * @extends {CircuitValue}
 */
export class BaseNumIndexSparseMerkleProof extends CircuitValue {
  static height: number;
  root: Field;
  path: Field;
  sideNodes: Field[];

  constructor(root: Field, path: Field, sideNodes: Field[]) {
    super();
    this.root = root;
    this.path = path;
    this.sideNodes = sideNodes;
  }

  height(): number {
    return (this.constructor as any).height;
  }

  /**
   * Calculate new root based on value. Note: This method cannot be executed in a circuit.
   *
   * @template V
   * @param {V} [value]
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Field}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  computeRoot<V extends FieldElements>(
    value?: V,
    hasher: Hasher = Poseidon.hash
  ): Field {
    let currentHash: Field;
    if (value !== undefined) {
      currentHash = hasher(value.toFields());
    } else {
      currentHash = SMT_EMPTY_VALUE;
    }

    let h = this.height();

    if (this.sideNodes.length !== h) {
      throw new Error('Invalid sideNodes size');
    }

    const pathBits = this.path.toBits(h);
    for (let i = h - 1; i >= 0; i--) {
      let node = this.sideNodes[i];
      if (pathBits[i].toBoolean() === RIGHT) {
        currentHash = hasher([node, currentHash]);
      } else {
        currentHash = hasher([currentHash, node]);
      }
    }

    return currentHash;
  }

  /**
   * Verify this merkle proof. Note: This method cannot be executed in a circuit.
   *
   * @template V
   * @param {Field} root
   * @param {V} [value]
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {boolean}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  verify<V extends FieldElements>(
    root: Field,
    value?: V,
    hasher: Hasher = Poseidon.hash
  ): boolean {
    if (this.root.equals(root).not().toBoolean()) {
      return false;
    }
    let newRoot = this.computeRoot<V>(value, hasher);

    return newRoot.equals(root).toBoolean();
  }

  verifyByField(
    expectedRoot: Field,
    valueHash: Field,
    hasher: Hasher = Poseidon.hash
  ): boolean {
    if (this.root.equals(expectedRoot).not().toBoolean()) {
      return false;
    }

    let newRoot = this.computeRootByField(valueHash, hasher);

    return newRoot.equals(expectedRoot).toBoolean();
  }

  /**
   * Calculate new root based on value and valueType in circuit.
   *
   * @template V
   * @param {V} value
   * @param {AsFieldElements<V>} valueType
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Field}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  computeRootInCircuit<V extends CircuitValue>(
    value: V,
    valueType: AsFieldElements<V>,
    hasher: Hasher = Poseidon.hash
  ): Field {
    const emptyValue = createEmptyValue<V>(valueType);
    let currentHash: Field = Circuit.if(
      value.equals(emptyValue).not(),
      hasher(value.toFields()),
      SMT_EMPTY_VALUE
    );

    return this.computeRootByFieldInCircuit(currentHash, hasher);
  }

  /**
   * Verify this merkle proof in circuit.
   *
   * @template V
   * @param {Field} root
   * @param {V} value
   * @param {AsFieldElements<V>} valueType
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Bool}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  verifyInCircuit<V extends CircuitValue>(
    root: Field,
    value: V,
    valueType: AsFieldElements<V>,
    hasher: Hasher = Poseidon.hash
  ): Bool {
    const rootEqual = this.root.equals(root);
    const currentHash = this.computeRootInCircuit(value, valueType, hasher);

    return rootEqual.and(currentHash.equals(root));
  }

  /**
   * Calculate new root based on valueHash in circuit.
   *
   * @param {Field} valueHash
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Field}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  computeRootByFieldInCircuit(
    valueHash: Field,
    hasher: Hasher = Poseidon.hash
  ): Field {
    let h = this.height();
    let currentHash: Field = valueHash;
    Field(this.sideNodes.length).assertEquals(h);

    const pathBits = this.path.toBits(h);
    for (let i = h - 1; i >= 0; i--) {
      let node = this.sideNodes[i];

      let currentValue = Circuit.if(
        pathBits[i],
        [node, currentHash],
        [currentHash, node]
      );

      currentHash = hasher(currentValue);
    }
    return currentHash;
  }

  computeRootByField(valueHash: Field, hasher: Hasher = Poseidon.hash): Field {
    let h = this.height();
    let currentHash: Field = valueHash;
    Field(this.sideNodes.length).assertEquals(h);

    const pathBits = this.path.toBits(h);
    for (let i = h - 1; i >= 0; i--) {
      let node = this.sideNodes[i];
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

  /**
   * Verify this merkle proof by root and valueHash in circuit.
   *
   * @param {Field} root
   * @param {Field} valueHash
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Bool}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  verifyByFieldInCircuit(
    root: Field,
    valueHash: Field,
    hasher: Hasher = Poseidon.hash
  ): Bool {
    const rootEqual = this.root.equals(root);
    const newRoot = this.computeRootByFieldInCircuit(valueHash, hasher);

    return rootEqual.and(newRoot.equals(root));
  }
}

/**
 * Create a meerkle proof circuit value type based on the specified tree height.
 *
 * @export
 * @param {number} height
 * @return {*}  {typeof BaseNumIndexSparseMerkleProof}
 */
export function NumIndexSparseMerkleProof(
  height: number
): typeof BaseNumIndexSparseMerkleProof {
  class NumIndexSparseMerkleProof_ extends BaseNumIndexSparseMerkleProof {
    static height = height;
  }
  if (!NumIndexSparseMerkleProof_.prototype.hasOwnProperty('_fields')) {
    (NumIndexSparseMerkleProof_.prototype as any)._fields = [];
  }

  (NumIndexSparseMerkleProof_.prototype as any)._fields.push(['root', Field]);
  (NumIndexSparseMerkleProof_.prototype as any)._fields.push(['path', Field]);
  arrayProp(Field, height)(NumIndexSparseMerkleProof_.prototype, 'sideNodes');

  return NumIndexSparseMerkleProof_;
}

/**
 * Compacted Merkle proof for an element in a NumIndexSparseMerkleTree
 *
 * @export
 * @interface NumIndexSparseCompactMerkleProof
 */
export interface NumIndexSparseCompactMerkleProof {
  height: number;
  root: Field;
  path: Field;
  sideNodes: Field[];
  bitMask: Field;
}

/**
 * Compact a num index sparse merkle proof to reduce its size
 *
 * @export
 * @param {BaseNumIndexSparseMerkleProof} proof
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {NumIndexSparseCompactMerkleProof}
 */
export function compactNumIndexProof(
  proof: BaseNumIndexSparseMerkleProof,
  hasher: Hasher = Poseidon.hash
): NumIndexSparseCompactMerkleProof {
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
    path: proof.path,
    sideNodes: compactSideNodes,
    bitMask: Field.ofBits(bits),
  };
}

/**
 * Decompact a NumIndexSparseCompactMerkleProof.
 *
 * @export
 * @param {NumIndexSparseCompactMerkleProof} proof
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {BaseNumIndexSparseMerkleProof}
 */
export function decompactNumIndexProof(
  proof: NumIndexSparseCompactMerkleProof,
  hasher: Hasher = Poseidon.hash
): BaseNumIndexSparseMerkleProof {
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

  class InnerNumIndexSparseMerkleProof extends NumIndexSparseMerkleProof(h) {}

  return new InnerNumIndexSparseMerkleProof(
    proof.root,
    proof.path,
    decompactedSideNodes
  );
}

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
