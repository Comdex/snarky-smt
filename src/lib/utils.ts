import { Bool, Field, Provable } from 'snarkyjs';

export {
  createEmptyValue,
  fieldToHexString,
  hexStringToField,
  strToFieldArry,
  countCommonPrefix,
  countSetBits,
  printBits,
};

/**
 * Create a empty value for a Struct Type
 *
 * @template T
 * @param {Provable<T>} valueType
 * @return {*}  {T}
 */
function createEmptyValue<T>(valueType: Provable<T>): T {
  const dummy = (() => {
    const n = valueType.sizeInFields();
    const xs = [];
    for (var i = 0; i < n; ++i) {
      xs.push(Field.zero);
    }
    return valueType.fromFields(xs, valueType.toAuxiliary());
  })();

  return dummy;
}

/**
 * Convert field to hex string.
 *
 * @param {Field} f
 * @return {*}  {string}
 */
function fieldToHexString(f: Field): string {
  return '0x' + f.toBigInt().toString(16);
}

/**
 * Convert hex strong to field.
 *
 * @param {string} hexStr
 * @return {*}  {Field}
 */
function hexStringToField(hexStr: string): Field {
  return Field(BigInt(hexStr));
}

/**
 * Convert a string to Field array.
 *
 * @param {string} str
 * @return {*}  {Field[]}
 */
function strToFieldArry(str: string): Field[] {
  const sarr = str.split(',');
  let fs: Field[] = [];

  for (let i = 0, len = sarr.length; i < len; i++) {
    let v = sarr[i];
    fs.push(new Field(v));
  }

  return fs;
}

function countCommonPrefix(data1bits: Bool[], data2bits: Bool[]): number {
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

function countSetBits(data: Bool[]): number {
  let count = 0;
  for (let i = 0, len = data.length; i < len; i++) {
    if (data[i].toBoolean()) {
      count++;
    }
  }
  return count;
}

/**
 * Print bits string.
 *
 * @param {Bool[]} data
 */
function printBits(data: Bool[], varName?: string) {
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
