import {
  AsFieldElements,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  Poseidon,
} from 'snarkyjs';
import { SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import { Hasher, SparseMerkleProof } from './proofs';
import { createEmptyValue } from './utils';

export {
  verifyProofInCircuit,
  computeRootInCircuit,
  verifyProofByFieldInCircuit,
  computeRootByFieldInCircuit,
};

/**
 * Verify a merkle proof in circuit.
 *
 * @export
 * @template K
 * @template V
 * @param {SparseMerkleProof} proof
 * @param {Field} expectedRoot
 * @param {K} key
 * @param {V} value
 * @param {AsFieldElements<V>} valueType
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Bool}
 */
function verifyProofInCircuit<K extends CircuitValue, V extends CircuitValue>(
  proof: SparseMerkleProof,
  expectedRoot: Field,
  key: K,
  value: V,
  valueType: AsFieldElements<V>,
  hasher: Hasher = Poseidon.hash
): Bool {
  const currentRoot = computeRootInCircuit(
    proof.sideNodes,
    key,
    value,
    valueType,
    hasher
  );

  return expectedRoot.equals(currentRoot);
}

/**
 * Calculate new root based on sideNodes, key and value in circuit.
 *
 * @export
 * @template K
 * @template V
 * @param {Field[]} sideNodes
 * @param {K} key
 * @param {V} value
 * @param {AsFieldElements<V>} valueType
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Field}
 */
function computeRootInCircuit<K extends CircuitValue, V extends CircuitValue>(
  sideNodes: Field[],
  key: K,
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

  const path = hasher(key.toFields());
  return computeRootByFieldInCircuit(sideNodes, path, currentHash, hasher);
}

/**
 * Verify a merkle proof by root, keyHash and valueHash in circuit.
 *
 * @export
 * @param {SparseMerkleProof} proof
 * @param {Field} expectedRoot
 * @param {Field} keyHash
 * @param {Field} valueHash
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Bool}
 */
function verifyProofByFieldInCircuit(
  proof: SparseMerkleProof,
  expectedRoot: Field,
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): Bool {
  const currentRoot = computeRootByFieldInCircuit(
    proof.sideNodes,
    keyHash,
    valueHash,
    hasher
  );

  return expectedRoot.equals(currentRoot);
}

/**
 * Calculate new root based on sideNodes, keyHash and valueHash in circuit.
 *
 * @export
 * @param {Field[]} sideNodes
 * @param {Field} keyHash
 * @param {Field} valueHash
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Field}
 */
function computeRootByFieldInCircuit(
  sideNodes: Field[],
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): Field {
  let currentHash: Field = valueHash;

  Field(sideNodes.length).assertEquals(SMT_DEPTH);

  const pathBits = keyHash.toBits(SMT_DEPTH);
  for (let i = SMT_DEPTH - 1; i >= 0; i--) {
    let node = sideNodes[i];

    let currentValue = Circuit.if(
      pathBits[i],
      [node, currentHash],
      [currentHash, node]
    );
    currentHash = hasher(currentValue);
  }
  return currentHash;
}
