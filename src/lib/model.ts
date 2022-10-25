import { CircuitValue, Field } from 'snarkyjs';

export type {
  FieldElements,
  SparseCompactMerkleProofJSON,
  NumIndexSparseCompactMerkleProofJSON,
};

type FieldElements = CircuitValue | Field;

// /**
//  * The interface is designed to be compatible with both CircuitValue and Field type.
//  *
//  * @export
//  * @interface FieldElements
//  */
// interface FieldElements {
//   toFields(): Field[];
// }

// A type used to support serialization to json for SparseCompactMerkleProof.
interface SparseCompactMerkleProofJSON {
  sideNodes: string[];
  bitMask: string;
  root: string;
}

/**
 * A type used to support serialization to json for NumIndexSparseCompactMerkleProof.
 *
 * @export
 * @interface NumIndexSparseCompactMerkleProofJSON
 */
interface NumIndexSparseCompactMerkleProofJSON {
  height: number;
  root: string;
  path: string;
  sideNodes: string[];
  bitMask: string;
}
