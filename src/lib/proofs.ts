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

export {
  BaseNumIndexSparseMerkleProof,
  NumIndexSparseMerkleProof,
  compactNumIndexProof,
  decompactNumIndexProof,
  SparseMerkleProof,
  computeRoot,
  verifyProof,
  verifyCompactProof,
  compactProof,
  decompactProof,
  getUpdatesBySideNodes,
};

export type {
  Hasher,
  NumIndexSparseCompactMerkleProof,
  SparseCompactMerkleProof,
};

type Hasher = (v: Field[]) => Field;

/**
 *  Merkle proof CircuitValue for an element in a NumIndexSparseMerkleTree.
 *
 * @export
 * @class BaseNumIndexSparseMerkleProof
 * @extends {CircuitValue}
 */
class BaseNumIndexSparseMerkleProof extends CircuitValue {
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
   * @param {Field} expectedRoot
   * @param {V} [value]
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {boolean}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  verify<V extends FieldElements>(
    expectedRoot: Field,
    value?: V,
    hasher: Hasher = Poseidon.hash
  ): boolean {
    if (!this.root.equals(expectedRoot).toBoolean()) {
      return false;
    }
    let currentRoot = this.computeRoot<V>(value, hasher);

    return currentRoot.equals(expectedRoot).toBoolean();
  }

  verifyByField(
    expectedRoot: Field,
    valueHash: Field,
    hasher: Hasher = Poseidon.hash
  ): boolean {
    if (!this.root.equals(expectedRoot).toBoolean()) {
      return false;
    }

    let currentRoot = this.computeRootByField(valueHash, hasher);

    return currentRoot.equals(expectedRoot).toBoolean();
  }

  verifyByFieldWithUpdates(
    expectedRoot: Field,
    valueHash: Field,
    hasher: Hasher = Poseidon.hash
  ): { ok: boolean; updates: [Field, Field[]][] } {
    if (!this.root.equals(expectedRoot).toBoolean()) {
      return { ok: false, updates: [] };
    }

    let { actualRoot, updates } = this.computeRootByFieldWithUpdates(
      valueHash,
      hasher
    );

    return { ok: actualRoot.equals(expectedRoot).toBoolean(), updates };
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
   * @param {Field} expectedRoot
   * @param {V} value
   * @param {AsFieldElements<V>} valueType
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Bool}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  verifyInCircuit<V extends CircuitValue>(
    expectedRoot: Field,
    value: V,
    valueType: AsFieldElements<V>,
    hasher: Hasher = Poseidon.hash
  ): Bool {
    const currentRoot = this.computeRootInCircuit(value, valueType, hasher);

    return expectedRoot.equals(currentRoot);
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

  computeRootByFieldWithUpdates(
    valueHash: Field,
    hasher: Hasher = Poseidon.hash
  ): { actualRoot: Field; updates: [Field, Field[]][] } {
    let h = this.height();
    let currentHash: Field = valueHash;
    let updates: [Field, Field[]][] = [];
    updates.push([currentHash, [currentHash]]);

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
      updates.push([currentHash, currentValue]);
    }
    return { actualRoot: currentHash, updates };
  }

  /**
   * Verify this merkle proof by root and valueHash in circuit.
   *
   * @param {Field} expectedRoot
   * @param {Field} valueHash
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Bool}
   * @memberof BaseNumIndexSparseMerkleProof
   */
  verifyByFieldInCircuit(
    expectedRoot: Field,
    valueHash: Field,
    hasher: Hasher = Poseidon.hash
  ): Bool {
    const currentRoot = this.computeRootByFieldInCircuit(valueHash, hasher);

    return expectedRoot.equals(currentRoot);
  }
}

/**
 * Create a meerkle proof circuit value type based on the specified tree height.
 *
 * @export
 * @param {number} height
 * @return {*}  {typeof BaseNumIndexSparseMerkleProof}
 */
function NumIndexSparseMerkleProof(
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
interface NumIndexSparseCompactMerkleProof {
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
function compactNumIndexProof(
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
function decompactNumIndexProof(
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
function computeRoot<K extends FieldElements, V extends FieldElements>(
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
 * @param {Field} expectedRoot
 * @param {K} key
 * @param {V} [value]
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {boolean}
 */
function verifyProof<K extends FieldElements, V extends FieldElements>(
  proof: SparseMerkleProof,
  expectedRoot: Field,
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): boolean {
  if (!proof.root.equals(expectedRoot).toBoolean()) {
    return false;
  }
  let newRoot = computeRoot<K, V>(proof.sideNodes, key, value, hasher);

  return newRoot.equals(expectedRoot).toBoolean();
}

/**
 * Verify a compacted merkle proof
 *
 * @export
 * @template K
 * @template V
 * @param {SparseCompactMerkleProof} cproof
 * @param {Field} expectedRoot
 * @param {K} key
 * @param {V} [value]
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {boolean}
 */
function verifyCompactProof<K extends FieldElements, V extends FieldElements>(
  cproof: SparseCompactMerkleProof,
  expectedRoot: Field,
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): boolean {
  const proof = decompactProof(cproof, hasher);
  return verifyProof(proof, expectedRoot, key, value, hasher);
}

/**
 * Compact a proof to reduce its size
 *
 * @export
 * @param {SparseMerkleProof} proof
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {SparseCompactMerkleProof}
 */
function compactProof(
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
function decompactProof(
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

function getUpdatesBySideNodes(
  sideNodes: Field[],
  keyHash: Field,
  valueHash: Field,
  height: number = SMT_DEPTH,
  hasher: Hasher = Poseidon.hash
): [Field, Field[]][] {
  let currentHash: Field = valueHash;
  let updates: [Field, Field[]][] = [];

  const pathBits = keyHash.toBits(height);
  updates.push([currentHash, [currentHash]]);

  for (let i = height - 1; i >= 0; i--) {
    let node = sideNodes[i];
    let currentValue: Field[] = [];

    if (pathBits[i].toBoolean()) {
      currentValue = [node, currentHash];
    } else {
      currentValue = [currentHash, node];
    }
    currentHash = hasher(currentValue);
    updates.push([currentHash, currentValue]);
  }

  return updates;
}
