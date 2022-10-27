import { Bool, Field, isReady, Poseidon } from 'snarkyjs';
import { FieldElements, Hasher } from '../model';

await isReady;

export { TreeHasher };

const emptyPrefix = Field(0);
const leafPrefix = Field(1);
const nodePrefix = Field(2);

class TreeHasher<K extends FieldElements, V extends FieldElements> {
  private hasher: Hasher;

  constructor(hasher: Hasher = Poseidon.hash) {
    this.hasher = hasher;
  }

  static poseidon<
    K extends FieldElements,
    V extends FieldElements
  >(): TreeHasher<K, V> {
    return new TreeHasher();
  }

  digest(data: V): Field {
    return this.hasher(data.toFields());
  }

  path(k: K): Field {
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

  isEmptyDataInCircuit(data: Field[]): Bool {
    return data[0].equals(emptyPrefix);
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
}
