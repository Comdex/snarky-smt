import { Field, JSONValue } from 'snarkyjs';

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

export type SparseCompactMerkleProofJSONValue = {
  sideNodes: string[];
  bitMask: string;
};
