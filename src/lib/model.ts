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

/**
 * Optional value for a CircuitValue
 *
 * @export
 * @class Optional
 * @extends {CircuitValue}
 * @template T
 */
export class Optional<T extends CircuitValue> extends CircuitValue {
  @prop isSome: Bool;
  @prop value: T;

  /**
   * Creates an instance of Optional.
   * @param {Bool} isSome empty value flag, false is empty.
   * @param {T} value actual value.
   * @memberof Optional
   */
  constructor(isSome: Bool, value: T) {
    super();
    this.isSome = isSome;
    this.value = value;
  }

  /**
   * Create a empty optional value for a CircuitValue Type
   *
   * @static
   * @template T
   * @param {AsFieldElements<T>} valueType
   * @return {*}  {Optional<T>}
   * @memberof Optional
   */
  public static empty<T extends CircuitValue>(
    valueType: AsFieldElements<T>
  ): Optional<T> {
    const dummy = (() => {
      const n = valueType.sizeInFields();
      const xs = [];
      for (var i = 0; i < n; ++i) {
        xs.push(Field.zero);
      }
      return valueType.ofFields(xs);
    })();

    return new Optional<T>(Bool(false), dummy);
  }

  /**
   * Create a optional value for a non-empty value.
   *
   * @static
   * @template T
   * @param {T} value
   * @return {*}  {Optional<T>}
   * @memberof Optional
   */
  public static of<T extends CircuitValue>(value: T): Optional<T> {
    return new Optional(Bool(true), value);
  }
}

// A type used to support serialization to json for SparseCompactMerkleProof
export type SparseCompactMerkleProofJSONValue = {
  sideNodes: string[];
  bitMask: string;
  root: string;
};
