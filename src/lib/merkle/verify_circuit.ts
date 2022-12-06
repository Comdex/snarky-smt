import { arrayProp, Bool, Circuit, Field, Poseidon, Provable } from 'snarkyjs';
import { EMPTY_VALUE } from '../constant';
import { Hasher } from '../model';
import { BaseMerkleProof } from './proofs';

export { ProvableMerkleTreeUtils };

/**
 * Collection of utility functions for merkle tree in the circuit.
 *
 * @class ProvableMerkleTreeUtils
 */
class ProvableMerkleTreeUtils {
  /**
   * Empty value for merkle tree
   *
   * @static
   * @memberof ProvableMerkleTreeUtils
   */
  static EMPTY_VALUE = EMPTY_VALUE;

  /**
   * Create a meerkle proof circuit value type based on the specified tree height.
   *
   * @static
   * @param {number} height
   * @return {*}  {typeof BaseMerkleProof}
   * @memberof ProvableMerkleTreeUtils
   */
  static MerkleProof(height: number): typeof BaseMerkleProof {
    class MerkleProof_ extends BaseMerkleProof {
      static height = height;
    }
    if (!MerkleProof_.prototype.hasOwnProperty('_fields')) {
      (MerkleProof_.prototype as any)._fields = [];
    }

    (MerkleProof_.prototype as any)._fields.push(['root', Field]);
    arrayProp(Field, height)(MerkleProof_.prototype, 'sideNodes');

    return MerkleProof_;
  }

  /**
   * Calculate new root based on index and value.
   *
   * @static
   * @template V
   * @param {BaseMerkleProof} proof
   * @param {Field} index
   * @param {V} value
   * @param {Provable<V>} valueType
   * @param {{ hasher?: Hasher; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash;
   * hashValue: whether to hash the value, the default is true.
   * @return {*}  {Field}
   * @memberof ProvableMerkleTreeUtils
   */
  static computeRoot<V>(
    proof: BaseMerkleProof,
    index: Field,
    value: V,
    valueType: Provable<V>,
    options: { hasher?: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): Field {
    let hasher = Poseidon.hash;
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    let valueFields = valueType.toFields(value);
    let valueHashOrValueField = valueFields[0];
    if (options.hashValue) {
      valueHashOrValueField = hasher(valueFields);
    }

    return computeRootByFieldInCircuit(
      proof,
      index,
      valueHashOrValueField,
      hasher
    );
  }

  /**
   * Returns true if the value is in the tree and it is at the index from the key
   *
   * @static
   * @template V
   * @param {BaseMerkleProof} proof
   * @param {Field} expectedRoot
   * @param {Field} index
   * @param {V} value
   * @param {Provable<V>} valueType
   * @param {{ hasher?: Hasher; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashValue: true,
   *     }]  hasher: The hash function to use, defaults to Poseidon.hash;
   * hashValue: whether to hash the value, the default is true.
   * @return {*}  {Bool}
   * @memberof ProvableMerkleTreeUtils
   */
  static checkMembership<V>(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: Field,
    value: V,
    valueType: Provable<V>,
    options: { hasher?: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): Bool {
    const currentRoot = this.computeRoot(
      proof,
      index,
      value,
      valueType,
      options
    );
    return expectedRoot.equals(currentRoot);
  }

  /**
   * Returns true if there is no value at the index from the key
   *
   * @static
   * @param {BaseMerkleProof} proof
   * @param {Field} expectedRoot
   * @param {Field} index
   * @param {Hasher} [hasher=Poseidon.hash]
   * @return {*}  {Bool}
   * @memberof ProvableMerkleTreeUtils
   */
  static checkNonMembership(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: Field,
    hasher: Hasher = Poseidon.hash
  ): Bool {
    const currentRoot = computeRootByFieldInCircuit(
      proof,
      index,
      EMPTY_VALUE,
      hasher
    );
    return expectedRoot.equals(currentRoot);
  }
}

function computeRootByFieldInCircuit(
  proof: BaseMerkleProof,
  index: Field,
  valueHashOrValueField: Field,
  hasher: Hasher = Poseidon.hash
): Field {
  let h = proof.height();
  let currentHash = valueHashOrValueField;

  const pathBits = index.toBits(h);
  for (let i = h - 1; i >= 0; i--) {
    let node = proof.sideNodes[i];

    let currentValue = Circuit.if(
      pathBits[i],
      [node, currentHash],
      [currentHash, node]
    );

    currentHash = hasher(currentValue);
  }
  return currentHash;
}
