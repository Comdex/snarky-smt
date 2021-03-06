export { SparseMerkleTree } from './lib/smt';
export { MultiVersionSparseMerkleTree } from './lib/multiversion_smt';
export { FieldElements, SparseCompactMerkleProofJSON } from './lib/model';
export {
  SparseMerkleProof,
  SparseCompactMerkleProof,
  Hasher,
  computeRoot,
  verifyProof,
  verifyCompactProof,
  compactProof,
  decompactProof,
} from './lib/proofs';
export {
  verifyProofInCircuit,
  verifyProofByFieldInCircuit,
  computeRootByFieldInCircuit,
  computeRootInCircuit,
} from './lib/verify_circuit';
export {
  strToFieldArry,
  printBits,
  compactMerkleProofToJson,
  jsonToCompactMerkleProof,
  fieldToHexString,
  hexStringToField,
  createEmptyValue,
} from './lib/utils';
export { Store } from './lib/store/store';
export { MemoryStore } from './lib/store/memory_store';
export { LevelStore } from './lib/store/level_store';
export { SMT_EMPTY_VALUE } from './lib/constant';

export { CSparseMerkleTree } from './lib/compact_tree/smt';
export { CDeepSparseMerkleSubTree } from './lib/compact_tree/deep_subtree';
export * from './lib/compact_tree/proofs';
export * from './lib/compact_tree/verify_circuit';
export { TreeHasher } from './lib/compact_tree/tree_hasher';
