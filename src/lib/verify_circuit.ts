import { Bool, Circuit, Field, Poseidon } from 'snarkyjs';
import { SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import { FieldElements } from './model';
import { Hasher, SparseMerkleProof } from './proofs';

export { ProvableSMTUtils };

class ProvableSMTUtils {
  static SMT_EMPTY_VALUE = SMT_EMPTY_VALUE;
  static verifyProofByField = verifyProofInCircuit;
  static computeRootByField = computeRootInCircuit;

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
  ): Bool {
    let keyFields = key.toFields();
    let valueFields = value.toFields();
    let keyHashOrKeyField = keyFields[0];
    if (options.hashKey) {
      keyHashOrKeyField = options.hasher(keyFields);
    }
    let valueHashOrValueField = valueFields[0];
    if (options.hashValue) {
      valueHashOrValueField = options.hasher(valueFields);
    }

    return verifyProofInCircuit(
      proof,
      expectedRoot,
      keyHashOrKeyField,
      valueHashOrValueField,
      options.hasher
    );
  }

  static checkNonMembership<K extends FieldElements>(
    proof: SparseMerkleProof,
    expectedRoot: Field,
    key: K,
    options: { hasher: Hasher; hashKey: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
    }
  ): Bool {
    let keyFields = key.toFields();
    let keyHashOrKeyField = keyFields[0];
    if (options.hashKey) {
      keyHashOrKeyField = options.hasher(keyFields);
    }

    return verifyProofInCircuit(
      proof,
      expectedRoot,
      keyHashOrKeyField,
      SMT_EMPTY_VALUE,
      options.hasher
    );
  }

  static computeRoot<K extends FieldElements, V extends FieldElements>(
    sideNodes: Field[],
    key: K,
    value: V,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ): Field {
    let keyFields = key.toFields();
    let valueFields = value.toFields();
    let keyHashOrKeyField = keyFields[0];
    if (options.hashKey) {
      keyHashOrKeyField = options.hasher(keyFields);
    }
    let valueHashOrValueField = valueFields[0];
    if (options.hashValue) {
      valueHashOrValueField = options.hasher(valueFields);
    }

    return computeRootInCircuit(
      sideNodes,
      keyHashOrKeyField,
      valueHashOrValueField,
      options.hasher
    );
  }
}

/**
 * Verify a merkle proof by root, keyHashOrKeyField and valueHashOrValueField in circuit.
 *
 * @export
 * @param {SparseMerkleProof} proof
 * @param {Field} expectedRoot
 * @param {Field} keyHashOrKeyField
 * @param {Field} valueHashOrValueField
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Bool}
 */
function verifyProofInCircuit(
  proof: SparseMerkleProof,
  expectedRoot: Field,
  keyHashOrKeyField: Field,
  valueHashOrValueField: Field,
  hasher: Hasher = Poseidon.hash
): Bool {
  const currentRoot = computeRootInCircuit(
    proof.sideNodes,
    keyHashOrKeyField,
    valueHashOrValueField,
    hasher
  );

  return expectedRoot.equals(currentRoot);
}

/**
 * Calculate new root based on sideNodes, keyHashOrKeyField and valueHashOrValueField in circuit.
 *
 * @export
 * @param {Field[]} sideNodes
 * @param {Field} keyHashOrKeyField
 * @param {Field} valueHashOrValueField
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Field}
 */
function computeRootInCircuit(
  sideNodes: Field[],
  keyHashOrKeyField: Field,
  valueHashOrValueField: Field,
  hasher: Hasher = Poseidon.hash
): Field {
  let currentHash = valueHashOrValueField;
  const pathBits = keyHashOrKeyField.toBits(SMT_DEPTH);

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
