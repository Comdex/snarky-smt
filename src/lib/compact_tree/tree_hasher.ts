import { Field, isReady, Poseidon } from 'snarkyjs';
import { FieldElements } from '../model';
import { Hasher } from '../proofs';

await isReady;
const leafPrefix = Field.zero;
const nodePrefix = Field.one;

export class TreeHasher<K extends FieldElements, V extends FieldElements> {
  protected hasher: Hasher;
  protected zeroValue: Field;

  constructor(hasher: Hasher = Poseidon.hash) {
    this.hasher = hasher;
    this.zeroValue = Field.zero;
  }

  public digest(data: V): Field {
    return this.hasher(data.toFields());
  }

  public path(k: K): Field {
    // support raw Field key, can not use instanceof Field
    const fs = k.toFields();
    if (fs.length === 1) {
      return fs[0];
    }
    return this.hasher(k.toFields());
  }

  public getHasher(): Hasher {
    return this.hasher;
  }

  public digestLeaf(
    path: Field,
    leafData: Field
  ): { hash: Field; value: Field[] } {
    const value: Field[] = [leafPrefix, path, leafData];

    return {
      hash: this.hasher(value),
      value,
    };
  }

  public parseLeaf(data: Field[]): { path: Field; leaf: Field } {
    return {
      path: data[1],
      leaf: data[2],
    };
  }

  public isLeaf(data: Field[]): boolean {
    return data[0].equals(leafPrefix).toBoolean();
  }

  public digestNode(
    leftData: Field,
    rightData: Field
  ): { hash: Field; value: Field[] } {
    const value: Field[] = [nodePrefix, leftData, rightData];

    return {
      hash: this.hasher(value),
      value,
    };
  }

  public parseNode(data: Field[]): { leftNode: Field; rightNode: Field } {
    return {
      leftNode: data[1],
      rightNode: data[2],
    };
  }

  public placeholder(): Field {
    return this.zeroValue;
  }
}
