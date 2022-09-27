export { SparseMerkleTree } from './lib/smt';
export { MultiVersionSparseMerkleTree } from './lib/multiversion_smt';
export { NumIndexSparseMerkleTree } from './lib/numindex_smt';
export {
  DeepSparseMerkleSubTree,
  NumIndexDeepSparseMerkleSubTree,
  NumIndexDeepSparseMerkleSubTreeForField,
} from './lib/deep_subtree';
export type {
  FieldElements,
  SparseCompactMerkleProofJSON,
  NumIndexSparseCompactMerkleProofJSON,
} from './lib/model';
export {
  SparseMerkleProof,
  type SparseCompactMerkleProof,
  type Hasher,
  computeRoot,
  verifyProof,
  verifyCompactProof,
  compactProof,
  decompactProof,
  NumIndexSparseMerkleProof,
  BaseNumIndexSparseMerkleProof,
  compactNumIndexProof,
  decompactNumIndexProof,
} from './lib/proofs';
export type { NumIndexSparseCompactMerkleProof } from './lib/proofs';
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
  compactNumIndexMerkleProofToJson,
  jsonToCompactMerkleProof,
  jsonToNumIndexCompactMerkleProof,
  fieldToHexString,
  hexStringToField,
  createEmptyValue,
} from './lib/utils';
export type { Store } from './lib/store/store';
export { MemoryStore } from './lib/store/memory_store';
export { LevelStore } from './lib/store/level_store';
export { SMT_EMPTY_VALUE } from './lib/constant';

export { CSparseMerkleTree } from './lib/compact_tree/smt';
export { CDeepSparseMerkleSubTree } from './lib/compact_tree/deep_subtree';
export * from './lib/compact_tree/proofs';
export * from './lib/compact_tree/verify_circuit';
export { TreeHasher } from './lib/compact_tree/tree_hasher';
