import { Bool, Circuit, CircuitValue, Field } from 'snarkyjs';
import { CP_PADD_VALUE, SMT_DEPTH, SMT_EMPTY_VALUE } from '../constant';
import { CompactSparseMerkleProof } from './proofs';
import { TreeHasher } from './tree_hasher';

export { c_verifyProofInCircuit, c_computeRootInCircuit };

/**
 * Verify CompactSparseMerkleProof.
 *
 * @template K
 * @template V
 * @param {CompactSparseMerkleProof} proof
 * @param {Field} expectedRoot
 * @param {Field} keyHashOrKeyField
 * @param {Field} valueHashOrValueField
 * @param {TreeHasher<K, V>} [th=TreeHasher.poseidon()]
 * @return {*}  {Bool}
 */
function c_verifyProofInCircuit<
  K extends CircuitValue | Field,
  V extends CircuitValue | Field
>(
  proof: CompactSparseMerkleProof,
  expectedRoot: Field,
  keyHashOrKeyField: Field,
  valueHashOrValueField: Field,
  th: TreeHasher<K, V> = TreeHasher.poseidon()
): Bool {
  const currentRoot = c_computeRootInCircuit(
    proof,
    keyHashOrKeyField,
    valueHashOrValueField,
    th
  );
  return expectedRoot.equals(currentRoot);
}

function c_computeRootInCircuit<
  K extends CircuitValue | Field,
  V extends CircuitValue | Field
>(
  proof: CompactSparseMerkleProof,
  keyHashOrKeyField: Field,
  valueHashOrValueField: Field,
  th: TreeHasher<K, V> = TreeHasher.poseidon()
): Field {
  const sideNodes = proof.sideNodes;
  const path = keyHashOrKeyField;

  const { path: actualPath, leaf: leafData } = th.parseLeaf(
    proof.nonMembershipLeafData
  );

  let currentHash = Circuit.if(
    valueHashOrValueField.equals(SMT_EMPTY_VALUE),
    Circuit.if(
      th.isEmptyDataInCircuit(proof.nonMembershipLeafData),
      SMT_EMPTY_VALUE,
      th.digestLeaf(actualPath, leafData).hash
    ),
    th.digestLeaf(path, valueHashOrValueField).hash
  );

  const pathBits = path.toBits(SMT_DEPTH);

  //Recompute root
  for (let i = 0, len = sideNodes.length; i < len; i++) {
    let node = sideNodes[i];

    // right node
    currentHash = Circuit.if(
      pathBits[len - 1 - i].and(node.equals(CP_PADD_VALUE).not()),
      th.digestNode(node, currentHash).hash,
      currentHash
    );

    // left node
    currentHash = Circuit.if(
      pathBits[len - 1 - i].not().and(node.equals(CP_PADD_VALUE).not()),
      th.digestNode(currentHash, node).hash,
      currentHash
    );
  }

  return currentHash;
}
