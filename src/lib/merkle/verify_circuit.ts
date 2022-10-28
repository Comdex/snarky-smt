import { arrayProp, Bool, Circuit, Field, Poseidon } from 'snarkyjs';
import { EMPTY_VALUE } from '../constant';
import { FieldElements, Hasher } from '../model';
import { BaseMerkleProof } from './proofs';

export { ProvableMerkleTreeUtils };

class ProvableMerkleTreeUtils {
  static EMPTY_VALUE = EMPTY_VALUE;

  /**
   * Create a meerkle proof circuit value type based on the specified tree height.
   *
   * @export
   * @param {number} height
   * @return {*}  {typeof MerkleProof}
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
   * Calculate new root based on index and value in circuit.
   *
   * @static
   * @template V
   * @param {BaseMerkleProof} proof
   * @param {Field} index
   * @param {V} value
   * @param {{ hasher: Hasher; hashValue: boolean }} [options={
   *       hasher: Poseidon.hash,
   *       hashValue: true,
   *     }]
   * @return {*}  {Field}
   * @memberof ProvableMerkleTreeUtils
   */
  static computeRoot<V extends FieldElements>(
    proof: BaseMerkleProof,
    index: Field,
    value: V,
    options: { hasher?: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): Field {
    let hasher = Poseidon.hash;
    if (options.hasher !== undefined) {
      hasher = options.hasher;
    }
    let valueFields = value.toFields();
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

  static checkMembership<V extends FieldElements>(
    proof: BaseMerkleProof,
    expectedRoot: Field,
    index: Field,
    value: V,
    options: { hasher?: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ): Bool {
    const currentRoot = this.computeRoot(proof, index, value, options);
    return expectedRoot.equals(currentRoot);
  }

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
