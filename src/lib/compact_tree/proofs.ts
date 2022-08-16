import {
  arrayProp,
  Bool,
  CircuitValue,
  Field,
  isReady,
  Poseidon,
  prop,
} from 'snarkyjs';
import { CP_PADD_VALUE, RIGHT, SMT_DEPTH } from '../constant';
import { FieldElements } from '../model';
import { Hasher } from '../proofs';
import { TreeHasher } from './tree_hasher';

await isReady;

/**
 * Proof for Compact Sparse Merkle Tree
 *
 * @export
 * @class CSparseMerkleProof
 * @extends {CircuitValue}
 */
export class CSparseMerkleProof extends CircuitValue {
  @arrayProp(Field, SMT_DEPTH) sideNodes: Field[];
  @arrayProp(Field, 3) nonMembershipLeafData: Field[];
  @arrayProp(Field, 3) siblingData: Field[];
  @prop root: Field;

  constructor(
    sideNodes: Field[],
    nonMembershipLeafData: Field[],
    siblingData: Field[],
    root: Field
  ) {
    super(sideNodes, nonMembershipLeafData, siblingData, root);

    // padd with CP_PADD_VALUE to a fixed length
    for (let i = sideNodes.length; i < SMT_DEPTH; i++) {
      sideNodes.push(CP_PADD_VALUE);
    }

    this.sideNodes = sideNodes;
    this.nonMembershipLeafData = nonMembershipLeafData;
    this.siblingData = siblingData;
    this.root = root;
  }
}

/**
 * SparseCompactMerkleProof for Compact Sparse Merkle Tree
 *
 * @export
 * @interface CSparseCompactMerkleProof
 */
export interface CSparseCompactMerkleProof {
  sideNodes: Field[];
  nonMembershipLeafData: Field[];
  bitMask: Field;
  numSideNodes: number;
  siblingData: Field[];
  root: Field;
}

/**
 * Verify Compact Proof for Compact Sparse Merkle Tree
 *
 * @export
 * @template K
 * @template V
 * @param {CSparseCompactMerkleProof} cproof
 * @param {Field} root
 * @param {K} key
 * @param {V} [value]
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {boolean}
 */
export function verifyCompactProof_C<
  K extends FieldElements,
  V extends FieldElements
>(
  cproof: CSparseCompactMerkleProof,
  root: Field,
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): boolean {
  const proof = decompactProof_C(cproof, hasher);
  return verifyProof_C<K, V>(proof, root, key, value, hasher);
}

export function verifyProofWithUpdates_C<
  K extends FieldElements,
  V extends FieldElements
>(
  proof: CSparseMerkleProof,
  root: Field,
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): {
  ok: boolean;
  updates: [Field, Field[]][] | null;
} {
  const th = new TreeHasher(hasher);
  const path = th.path(key);

  let updates: [Field, Field[]][] = [];
  let currentHash: Field;
  let currentData: Field[];
  if (value === undefined) {
    //Non-membership proof
    if (th.isEmptyData(proof.nonMembershipLeafData)) {
      currentHash = th.placeholder();
    } else {
      const { path: actualPath, leaf: valueHash } = th.parseLeaf(
        proof.nonMembershipLeafData
      );
      if (actualPath.equals(path).toBoolean()) {
        return {
          ok: false,
          updates: null,
        };
      }
      const result = th.digestLeaf(actualPath, valueHash);
      currentHash = result.hash;
      currentData = result.value;
      let update: [Field, Field[]] = [currentHash, currentData];
      updates.push(update);
    }
  } else {
    // Membership proof
    const valueHash = th.digest(value);
    const result = th.digestLeaf(path, valueHash);
    currentHash = result.hash;
    currentData = result.value;
    const update: [Field, Field[]] = [currentHash, currentData];
    updates.push(update);
  }

  const pathBits = path.toBits();
  //Recompute root
  let sideNodesLength = proof.sideNodes.length;
  for (let i = 0; i < sideNodesLength; i++) {
    let node = proof.sideNodes[i];
    if (node.equals(CP_PADD_VALUE).toBoolean()) {
      break;
    }

    if (pathBits[sideNodesLength - 1 - i].toBoolean() === RIGHT) {
      const result = th.digestNode(node, currentHash);
      currentHash = result.hash;
      currentData = result.value;
    } else {
      const result = th.digestNode(currentHash, node);
      currentHash = result.hash;
      currentData = result.value;
    }

    const update: [Field, Field[]] = [currentHash, currentData];
    updates.push(update);
  }

  return {
    ok: currentHash.equals(root).toBoolean(),
    updates,
  };
}

/**
 * Verify Proof of Compact Sparse Merkle Tree
 *
 * @export
 * @template K
 * @template V
 * @param {CSparseMerkleProof} proof
 * @param {Field} root
 * @param {K} key
 * @param {V} [value]
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {boolean}
 */
export function verifyProof_C<K extends FieldElements, V extends FieldElements>(
  proof: CSparseMerkleProof,
  root: Field,
  key: K,
  value?: V,
  hasher: Hasher = Poseidon.hash
): boolean {
  const { ok } = verifyProofWithUpdates_C<K, V>(
    proof,
    root,
    key,
    value,
    hasher
  );
  return ok;
}

/**
 * Compact proof Of Compact Sparse Merkle Tree
 *
 * @export
 * @param {CSparseMerkleProof} proof
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {CSparseCompactMerkleProof}
 */
export function compactProof_C(
  proof: CSparseMerkleProof,
  hasher: Hasher = Poseidon.hash
): CSparseCompactMerkleProof {
  const th = new TreeHasher(hasher);
  const sideNodes = proof.sideNodes;
  const sideNodesLength = sideNodes.length;
  let bits = Array<Bool>(SMT_DEPTH).fill(Bool(false));

  let compactedSideNodes = [];
  let oriSideNodesLength = 0;
  for (let i = 0; i < sideNodesLength; i++) {
    if (sideNodes[i].equals(CP_PADD_VALUE).toBoolean()) {
      break;
    }

    oriSideNodesLength++;
    if (sideNodes[i].equals(th.placeholder()).toBoolean()) {
      bits[i] = Bool(true);
    } else {
      compactedSideNodes.push(sideNodes[i]);
    }
  }

  return {
    sideNodes: compactedSideNodes,
    nonMembershipLeafData: proof.nonMembershipLeafData,
    bitMask: Field.ofBits(bits),
    numSideNodes: oriSideNodesLength,
    siblingData: proof.siblingData,
    root: proof.root,
  };
}

/**
 * Decompact compact proof of Compact Sparse Merkle Tree
 *
 * @export
 * @param {CSparseCompactMerkleProof} proof
 * @param {Hasher} [hasher=Poseidon.hash]
 * @return {*}  {CSparseMerkleProof}
 */
export function decompactProof_C(
  proof: CSparseCompactMerkleProof,
  hasher: Hasher = Poseidon.hash
): CSparseMerkleProof {
  const th = new TreeHasher(hasher);
  let decompactedSideNodes = [];
  let position = 0;

  const bits = proof.bitMask.toBits();
  for (let i = 0; i < proof.numSideNodes; i++) {
    if (bits[i].toBoolean()) {
      decompactedSideNodes[i] = th.placeholder();
    } else {
      decompactedSideNodes[i] = proof.sideNodes[position];
      position++;
    }
  }

  return new CSparseMerkleProof(
    decompactedSideNodes,
    proof.nonMembershipLeafData,
    proof.siblingData,
    proof.root
  );
}
