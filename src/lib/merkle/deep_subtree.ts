import { Field, Poseidon } from 'snarkyjs';
import { EMPTY_VALUE } from '../constant';
import { FieldElements, Hasher } from '../model';
import { BaseMerkleProof, MerkleTreeUtils } from './proofs';
import { ProvableMerkleTreeUtils } from './verify_circuit';

export { DeepMerkleSubTree };

class DeepMerkleSubTree<V extends FieldElements> {
  private nodeStore: Map<string, Field[]>;
  private valueStore: Map<string, Field>;
  private root: Field;
  private height: number;
  private hasher: Hasher;
  private hashValue: boolean;

  constructor(
    root: Field,
    height: number,
    options: { hasher: Hasher; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashValue: true,
    }
  ) {
    this.root = root;
    this.nodeStore = new Map<string, Field[]>();
    this.valueStore = new Map<string, Field>();
    this.height = height;
    this.hasher = options.hasher;
    this.hashValue = options.hashValue;
  }

  public getRoot(): Field {
    return this.root;
  }

  public getHeight(): number {
    return this.height;
  }

  private getValueField(value?: V): Field {
    let valueHashOrValueField = EMPTY_VALUE;
    if (value !== undefined) {
      let valueFields = value.toFields();
      valueHashOrValueField = valueFields[0];
      if (this.hashValue) {
        valueHashOrValueField = this.hasher(valueFields);
      }
    }

    return valueHashOrValueField;
  }

  public has(index: bigint, value: V): boolean {
    const path = Field(index);
    const valueField = this.getValueField(value);

    let v = this.valueStore.get(path.toString());
    if (v === undefined || !v.equals(valueField).toBoolean()) {
      return false;
    }

    return true;
  }

  public addBranch(
    proof: BaseMerkleProof,
    index: bigint,
    value?: V,
    ignoreInvalidProof: boolean = false
  ) {
    const path = Field(index);
    const valueField = this.getValueField(value);

    let { ok, updates } = MerkleTreeUtils.verifyProofByFieldWithUpdates(
      proof,
      this.root,
      index,
      valueField,
      this.hasher
    );

    if (!ok) {
      if (!ignoreInvalidProof) {
        throw new Error(
          `invalid proof, proof path: ${path.toString()}, valueField: ${valueField.toString()}`
        );
      } else {
        return;
      }
    }

    for (let i = 0, len = updates.length; i < len; i++) {
      let v = updates[i];
      this.nodeStore.set(v[0].toString(), v[1]);
    }

    this.valueStore.set(path.toString(), valueField);
  }

  public prove(index: bigint): BaseMerkleProof {
    const path = Field(index);
    let pathStr = path.toString();
    let valueHash = this.valueStore.get(pathStr);
    if (valueHash === undefined) {
      throw new Error(
        `The DeepSubTree does not contain a branch of the path: ${pathStr}`
      );
    }
    const pathBits = path.toBits(this.height);
    let sideNodes: Field[] = [];
    let nodeHash: Field = this.root;
    for (let i = 0; i < this.height; i++) {
      const currentValue = this.nodeStore.get(nodeHash.toString());
      if (currentValue === undefined) {
        throw new Error(
          'Make sure you have added the correct proof, key and value using the addBranch method'
        );
      }

      if (pathBits[i].toBoolean()) {
        sideNodes.push(currentValue[0]);
        nodeHash = currentValue[1];
      } else {
        sideNodes.push(currentValue[1]);
        nodeHash = currentValue[0];
      }
    }

    class MerkleProof_ extends ProvableMerkleTreeUtils.MerkleProof(
      this.height
    ) {}

    return new MerkleProof_(this.root, sideNodes);
  }

  public update(index: bigint, value?: V): Field {
    const path = Field(index);
    const valueField = this.getValueField(value);

    const pathBits = path.toBits(this.height);
    let sideNodes: Field[] = [];
    let nodeHash: Field = this.root;
    for (let i = 0; i < this.height; i++) {
      const currentValue = this.nodeStore.get(nodeHash.toString());
      if (currentValue === undefined) {
        throw new Error(
          'Make sure you have added the correct proof, key and value using the addBranch method'
        );
      }

      if (pathBits[i].toBoolean()) {
        sideNodes.push(currentValue[0]);
        nodeHash = currentValue[1];
      } else {
        sideNodes.push(currentValue[1]);
        nodeHash = currentValue[0];
      }
    }

    let currentHash = valueField;
    this.nodeStore.set(currentHash.toString(), [currentHash]);

    for (let i = this.height - 1; i >= 0; i--) {
      let sideNode = sideNodes[i];

      let currentValue: Field[] = [];
      if (pathBits[i].toBoolean()) {
        currentValue = [sideNode, currentHash];
      } else {
        currentValue = [currentHash, sideNode];
      }

      currentHash = this.hasher(currentValue);
      this.nodeStore.set(currentHash.toString(), currentValue);
    }

    this.valueStore.set(path.toString(), valueField);
    this.root = currentHash;

    return this.root;
  }
}
