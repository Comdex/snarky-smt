export { SparseMerkleTree } from './lib/smt';
export { MultiVersionSparseMerkleTree } from './lib/multiversion_smt';
export { NumIndexSparseMerkleTree } from './lib/numindex_smt';
export {
  DeepSparseMerkleSubTree,
  NumIndexDeepSparseMerkleSubTree,
} from './lib/deep_subtree';
export {
  ProvableDeepSparseMerkleSubTree,
  ProvableNumIndexDeepSparseMerkleSubTree,
} from './lib/deep_subtree_circuit';
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
export * from './lib/verify_circuit';
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

export { CompactSparseMerkleTree } from './lib/compact_smt/smt';
export { CompactDeepSparseMerkleSubTree } from './lib/compact_smt/deep_subtree';
export * from './lib/compact_smt/proofs';
export * from './lib/compact_smt/verify_circuit';
export { TreeHasher } from './lib/compact_smt/tree_hasher';
