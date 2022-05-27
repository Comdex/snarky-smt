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

/**
 * Verify a merkle proof in circuit.
 *
 * @export
 * @template K
 * @template V
 * @param {SparseMerkleProof} proof
 * @param {Field} root
 * @param {K} key
 * @param {V} value
 * @param {AsFieldElements<V>} valueType
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Bool}
 */
export function verifyProofInCircuit<
  K extends CircuitValue,
  V extends CircuitValue
>(
  proof: SparseMerkleProof,
  root: Field,
  key: K,
  value: V,
  valueType: AsFieldElements<V>,
  hasher: Hasher = Poseidon.hash
): Bool {
  const currentHash = computeRootInCircuit(
    proof.sideNodes,
    key,
    value,
    valueType,
    hasher
  );

  return currentHash.equals(root);
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
export function computeRootInCircuit<
  K extends CircuitValue,
  V extends CircuitValue
>(
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

  Field(sideNodes.length).assertEquals(SMT_DEPTH);

  const path = hasher(key.toFields());
  const pathBits = path.toBits();
  for (let i = SMT_DEPTH - 1; i >= 0; i--) {
    let node = sideNodes[i];
    currentHash = Circuit.if<Field>(
      pathBits[i],
      hasher([node, currentHash]),
      hasher([currentHash, node])
    );
  }

  return currentHash;
}

/**
 * Verify a merkle proof by root, keyHash and valueHash in circuit.
 *
 * @export
 * @param {SparseMerkleProof} proof
 * @param {Field} root
 * @param {Field} keyHash
 * @param {Field} valueHash
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Bool}
 */
export function verifyProofByFieldInCircuit(
  proof: SparseMerkleProof,
  root: Field,
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): Bool {
  const newRoot = computeRootByFieldInCircuit(
    proof.sideNodes,
    keyHash,
    valueHash,
    hasher
  );

  return newRoot.equals(root);
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
export function computeRootByFieldInCircuit(
  sideNodes: Field[],
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): Field {
  let currentHash: Field = valueHash;

  Field(sideNodes.length).assertEquals(SMT_DEPTH);

  const pathBits = keyHash.toBits();
  for (let i = SMT_DEPTH - 1; i >= 0; i--) {
    let node = sideNodes[i];
    currentHash = Circuit.if<Field>(
      pathBits[i],
      hasher([node, currentHash]),
      hasher([currentHash, node])
    );
  }
  return currentHash;
}
