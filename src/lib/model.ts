import {
  AsFieldElements,
  Bool,
  CircuitValue,
  Field,
  JSONValue,
  prop,
} from 'snarkyjs';

/**
 * The interface is designed to be compatible with both CircuitValue and Field type.
 *
 * @export
 * @interface FieldElements
 */
export interface FieldElements {
  toFields(): Field[];
  toJSON(): JSONValue;
}

// A type used to support serialization to json for SparseCompactMerkleProof
export interface SparseCompactMerkleProofJSON {
  sideNodes: string[];
  bitMask: string;
  root: string;
}
