import { Bool, Circuit, CircuitValue, Field, Poseidon } from 'snarkyjs';
import { SMT_DEPTH } from '../constant';
import { Optional } from '../model';
import { Hasher } from '../proofs';
import { CSparseMerkleProof } from './proofs';
import { TreeHasher } from './tree_hasher';

/**
 * Since a variable-length array cannot be defined in CircuitValue, it cannot be executed in zkapps temporarily.
 *
 * @export
 * @template K
 * @template V
 * @param {CSparseMerkleProof} proof
 * @param {Field} root
 * @param {K} key
 * @param {V} value
 * @param {AsFieldElements<V>} valueType
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {Bool}
 */
export function verifyProofInCircuit_C<
  K extends CircuitValue,
  V extends CircuitValue
>(
  proof: CSparseMerkleProof,
  root: Field,
  key: K,
  optionalValue: Optional<V>,
  hasher: Hasher = Poseidon.hash
): Bool {
  Field(proof.sideNodes.length).assertLte(SMT_DEPTH);
  Field(proof.nonMembershipLeafData.length).assertEquals(3);

  const th = new TreeHasher(hasher);
  const path = th.path(key);

  let currentHash: Field;
  const { path: actualPath, leaf: leafHash } = th.parseLeaf(
    proof.nonMembershipLeafData
  );

  const valueHash = th.digest(optionalValue.value);
  currentHash = Circuit.if(
    optionalValue.isSome.not(),
    Circuit.if(
      proof.nonMembershipLeafData[0].equals(Field.zero),
      th.placeholder(),
      th.digestLeaf(actualPath, leafHash).hash
    ),
    Circuit.if(
      proof.nonMembershipLeafData[0].equals(Field.zero),
      th.placeholder(),
      th.digestLeaf(path, valueHash).hash
    )
  );

  const pathBits = path.toBits();
  //Recompute root
  let sideNodesLength = proof.sideNodes.length;
  for (let i = 0; i < sideNodesLength; i++) {
    let node = proof.sideNodes[i];

    currentHash = Circuit.if(
      pathBits[sideNodesLength - 1 - i],
      th.digestNode(node, currentHash).hash,
      th.digestNode(currentHash, node).hash
    );
  }

  return currentHash.equals(root);
}
