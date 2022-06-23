import { Field, isReady, Poseidon } from 'snarkyjs';
import { FieldElements } from '../model';
import { Hasher } from '../proofs';

await isReady;
const emptyPrefix = Field.zero;
const leafPrefix = Field.one;
const nodePrefix = Field(2);

export class TreeHasher<K extends FieldElements, V extends FieldElements> {
  private hasher: Hasher;
  private zeroValue: Field;

  constructor(hasher: Hasher = Poseidon.hash) {
    this.hasher = hasher;
    this.zeroValue = Field.zero;
  }

  digest(data: V): Field {
    return this.hasher(data.toFields());
  }

  path(k: K): Field {
    // support raw Field key, can not use instanceof Field
    const fs = k.toFields();
    if (fs.length === 1) {
      return fs[0];
    }
    return this.hasher(k.toFields());
  }

  getHasher(): Hasher {
    return this.hasher;
  }

  digestLeaf(path: Field, leafData: Field): { hash: Field; value: Field[] } {
    const value: Field[] = [leafPrefix, path, leafData];

    return {
      hash: this.hasher(value),
      value,
    };
  }

  parseLeaf(data: Field[]): { path: Field; leaf: Field } {
    return {
      path: data[1],
      leaf: data[2],
    };
  }

  isLeaf(data: Field[]): boolean {
    return data[0].equals(leafPrefix).toBoolean();
  }

  isEmptyData(data: Field[]): boolean {
    return data[0].equals(emptyPrefix).toBoolean();
  }

  emptyData(): Field[] {
    return [emptyPrefix, Field.zero, Field.zero];
  }

  digestNode(
    leftData: Field,
    rightData: Field
  ): { hash: Field; value: Field[] } {
    const value: Field[] = [nodePrefix, leftData, rightData];

    return {
      hash: this.hasher(value),
      value,
    };
  }

  parseNode(data: Field[]): { leftNode: Field; rightNode: Field } {
    return {
      leftNode: data[1],
      rightNode: data[2],
    };
  }

  placeholder(): Field {
    return this.zeroValue;
  }
}
