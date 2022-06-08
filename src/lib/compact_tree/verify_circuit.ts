import { Bool, Circuit, CircuitValue, Field, Poseidon } from 'snarkyjs';
import { CP_PADD_VALUE, SMT_DEPTH } from '../constant';
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
  Field(proof.sideNodes.length).assertEquals(SMT_DEPTH);

  const th = new TreeHasher(hasher);
  const path = th.path(key);

  let currentHash: Field;
  const { path: actualPath, leaf: leafHash } = th.parseLeaf(
    proof.nonMembershipLeafData.value.nonMembershipLeafData
  );

  const valueHash = th.digest(optionalValue.value);
  currentHash = Circuit.if(
    optionalValue.isSome,
    Circuit.if(
      proof.nonMembershipLeafData.isSome,
      th.placeholder(),
      th.digestLeaf(path, valueHash).hash
    ),
    Circuit.if(
      proof.nonMembershipLeafData.isSome,
      th.digestLeaf(actualPath, leafHash).hash,
      th.placeholder()
    )
  );

  const pathBits = path.toBits();
  //Recompute root
  let sideNodesLength = proof.sideNodes.length;

  for (let i = 0; i < sideNodesLength; i++) {
    let node = proof.sideNodes[i];

    // right node
    currentHash = Circuit.if(
      pathBits[sideNodesLength - 1 - i].and(node.equals(CP_PADD_VALUE).not()),
      th.digestNode(node, currentHash).hash,
      currentHash
    );

    // left node
    currentHash = Circuit.if(
      pathBits[sideNodesLength - 1 - i]
        .not()
        .and(node.equals(CP_PADD_VALUE).not()),
      th.digestNode(currentHash, node).hash,
      currentHash
    );
  }

  return currentHash.equals(root);
}
