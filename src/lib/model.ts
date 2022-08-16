import { Field } from 'snarkyjs';

/**
 * The interface is designed to be compatible with both CircuitValue and Field type.
 *
 * @export
 * @interface FieldElements
 */
export interface FieldElements {
  toFields(): Field[];
}

// A type used to support serialization to json for SparseCompactMerkleProof
export interface SparseCompactMerkleProofJSON {
  sideNodes: string[];
  bitMask: string;
  root: string;
}