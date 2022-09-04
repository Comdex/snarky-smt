import { AsFieldElements, Bool, CircuitValue, Field } from 'snarkyjs';
import {
  NumIndexSparseCompactMerkleProofJSON,
  SparseCompactMerkleProofJSON,
} from './model';
import {
  NumIndexSparseCompactMerkleProof,
  SparseCompactMerkleProof,
} from './proofs';

/**
 * Create a empty value for a CircuitValue Type
 *
 * @export
 * @template T
 * @param {AsFieldElements<T>} valueType
 * @return {*}  {T}
 */
export function createEmptyValue<T extends CircuitValue>(
  valueType: AsFieldElements<T>
): T {
  const dummy = (() => {
    const n = valueType.sizeInFields();
    const xs = [];
    for (var i = 0; i < n; ++i) {
      xs.push(Field.zero);
    }
    return valueType.ofFields(xs);
  })();

  return dummy;
}

/**
 * Convert SparseCompactMerkleProof to JSONValue.
 *
 * @export
 * @param {SparseCompactMerkleProof} proof
 * @return {*}  {SparseCompactMerkleProofJSONValue}
 */
export function compactMerkleProofToJson(
  proof: SparseCompactMerkleProof
): SparseCompactMerkleProofJSON {
  let sideNodesStrArr: string[] = [];
  proof.sideNodes.forEach((v) => {
    const str = fieldToHexString(v);
    sideNodesStrArr.push(str);
  });

  return {
    sideNodes: sideNodesStrArr,
    bitMask: fieldToHexString(proof.bitMask),
    root: fieldToHexString(proof.root),
  };
}

/**
 * Convert NumIndexSparseCompactMerkleProof to JSONValue.
 *
 * @export
 * @param {NumIndexSparseCompactMerkleProof} proof
 * @return {*}  {NumIndexSparseCompactMerkleProofJSON}
 */
export function compactNumIndexMerkleProofToJson(
  proof: NumIndexSparseCompactMerkleProof
): NumIndexSparseCompactMerkleProofJSON {
  let sideNodesStrArr: string[] = [];
  proof.sideNodes.forEach((v) => {
    const str = fieldToHexString(v);
    sideNodesStrArr.push(str);
  });

  return {
    height: proof.height,
    root: fieldToHexString(proof.root),
    path: fieldToHexString(proof.path),
    sideNodes: sideNodesStrArr,
    bitMask: fieldToHexString(proof.bitMask),
  };
}

/**
 * Convert JSONValue to SparseCompactMerkleProof
 *
 * @export
 * @param {SparseCompactMerkleProofJSONValue} jsonValue
 * @return {*}  {SparseCompactMerkleProof}
 */
export function jsonToCompactMerkleProof(
  jsonValue: SparseCompactMerkleProofJSON
): SparseCompactMerkleProof {
  let sideNodes: Field[] = [];
  jsonValue.sideNodes.forEach((v) => {
    const f = hexStringToField(v);
    sideNodes.push(f);
  });

  return {
    sideNodes,
    bitMask: hexStringToField(jsonValue.bitMask),
    root: hexStringToField(jsonValue.root),
  };
}

/**
 * Convert JSONValue to NumIndexSparseCompactMerkleProof
 *
 * @export
 * @param {NumIndexSparseCompactMerkleProofJSON} jsonValue
 * @return {*}  {NumIndexSparseCompactMerkleProof}
 */
export function jsonToNumIndexCompactMerkleProof(
  jsonValue: NumIndexSparseCompactMerkleProofJSON
): NumIndexSparseCompactMerkleProof {
  let sideNodes: Field[] = [];
  jsonValue.sideNodes.forEach((v) => {
    const f = hexStringToField(v);
    sideNodes.push(f);
  });

  return {
    height: jsonValue.height,
    root: hexStringToField(jsonValue.root),
    path: hexStringToField(jsonValue.path),
    sideNodes,
    bitMask: hexStringToField(jsonValue.bitMask),
  };
}

/**
 * Convert field to hex string.
 *
 * @export
 * @param {Field} f
 * @return {*}  {string}
 */
export function fieldToHexString(f: Field): string {
  return '0x' + f.toBigInt().toString(16);
}

/**
 * Convert hex strong to field.
 *
 * @export
 * @param {string} hexStr
 * @return {*}  {Field}
 */
export function hexStringToField(hexStr: string): Field {
  return Field(BigInt(hexStr));
}

/**
 * Convert a string to Field array.
 *
 * @export
 * @param {string} str
 * @return {*}  {Field[]}
 */
export function strToFieldArry(str: string): Field[] {
  const sarr = str.split(',');
  let fs: Field[] = [];

  sarr.forEach((v) => {
    fs.push(new Field(v));
  });

  return fs;
}

export function countCommonPrefix(
  data1bits: Bool[],
  data2bits: Bool[]
): number {
  let count = 0;
  const len = data1bits.length;

  for (let i = 0; i < len; i++) {
    if (data1bits[i].equals(data2bits[i]).toBoolean()) {
      count++;
    } else {
      break;
    }
  }

  return count;
}

export function countSetBits(data: Bool[]): number {
  let count = 0;
  for (let i = 0; i < data.length; i++) {
    if (data[i].toBoolean()) {
      count++;
    }
  }
  return count;
}

/**
 * Print bits string.
 *
 * @export
 * @param {Bool[]} data
 */
export function printBits(data: Bool[], varName?: string) {
  let str = '';
  let i = 0;
  data.forEach((v) => {
    if (v.toBoolean()) {
      str = str + '1';
    } else {
      str = str + '0';
    }
    i++;
  });

  if (varName) {
    console.log(`[${varName}]: ${str}, bit size: ${i}`);
  } else {
    console.log(`bit data: ${str}, bit size: ${i}`);
  }
}
