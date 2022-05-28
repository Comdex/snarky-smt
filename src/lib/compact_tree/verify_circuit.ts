import {
  AsFieldElements,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  Poseidon,
} from 'snarkyjs';
import { LEFT, SMT_DEPTH } from '../constant';
import { Hasher } from '../proofs';
import { createEmptyValue } from '../utils';
import { CSparseMerkleProof } from './proofs';
import { TreeHasher } from './tree_hasher';

/**
 * Since a variable-length array cannot be defined in CircuitValue, it cannot be implemented temporarily.
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
  value: V,
  valueType: AsFieldElements<V>,
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

  const valueHash = th.digest(value);
  const emptyValue = createEmptyValue<V>(valueType);
  currentHash = Circuit.if(
    value.equals(emptyValue),
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
      currentHash
    );

    currentHash = Circuit.if(
      pathBits[sideNodesLength - 1 - i].equals(Bool(LEFT)),
      th.digestNode(currentHash, node).hash,
      currentHash
    );
  }

  return currentHash.equals(root);
}
