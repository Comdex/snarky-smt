import { Field, Poseidon } from 'snarkyjs';
import { SMT_DEPTH } from './constant';
import {
  BaseNumIndexSparseMerkleProof,
  Hasher,
  NumIndexSparseMerkleProof,
  SparseMerkleProof,
} from './proofs';

export { DeepSparseMerkleSubTree, NumIndexDeepSparseMerkleSubTree };

class DeepSparseMerkleSubTree {
  private nodeStore: Map<string, Field[]>;
  private valueStore: Map<string, Field>;
  private root: Field;
  private hasher: Hasher;

  constructor(root: Field, hasher: Hasher = Poseidon.hash) {
    this.root = root;
    this.nodeStore = new Map<string, Field[]>();
    this.valueStore = new Map<string, Field>();
    this.hasher = hasher;
  }

  public getRoot(): Field {
    return this.root;
  }

  public getHeight(): number {
    return SMT_DEPTH;
  }

  public has(keyHash: Field, valueHash: Field): boolean {
    let v = this.valueStore.get(keyHash.toString());
    if (v === undefined || !v.equals(valueHash).toBoolean()) {
      return false;
    }

    return true;
  }

  public addBranch(proof: SparseMerkleProof, keyHash: Field, valueHash: Field) {
    let { ok, updates } = verifyProofWithUpdates(
      proof,
      this.root,
      keyHash,
      valueHash,
      this.hasher
    );
    if (!ok) {
      throw new Error('invalid proof');
    }

    for (let i = 0, len = updates.length; i < len; i++) {
      let v = updates[i];
      this.nodeStore.set(v[0].toString(), v[1]);
    }

    this.valueStore.set(keyHash.toString(), valueHash);
  }

  public prove(keyHash: Field): SparseMerkleProof {
    const path = keyHash;
    let pathStr = path.toString();
    let valueHash = this.valueStore.get(pathStr);
    if (valueHash === undefined) {
      throw new Error(
        `The DeepSubTree does not contain a branch of the path: ${pathStr}`
      );
    }
    let treeHeight = this.getHeight();
    const pathBits = path.toBits(treeHeight);
    let sideNodes: Field[] = [];
    let nodeHash: Field = this.root;
    for (let i = 0; i < treeHeight; i++) {
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

    return new SparseMerkleProof(sideNodes, this.root);
  }

  public update(keyHash: Field, valueHash: Field): Field {
    const path = keyHash;
    const treeHeight = this.getHeight();
    const pathBits = path.toBits(treeHeight);

    let sideNodes: Field[] = [];
    let nodeHash: Field = this.root;

    for (let i = 0; i < treeHeight; i++) {
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

    let currentHash = valueHash;
    this.nodeStore.set(currentHash.toString(), [currentHash]);

    for (let i = this.getHeight() - 1; i >= 0; i--) {
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

    this.valueStore.set(path.toString(), valueHash);
    this.root = currentHash;

    return this.root;
  }
}

class NumIndexDeepSparseMerkleSubTree {
  private nodeStore: Map<string, Field[]>;
  private valueStore: Map<string, Field>;
  private root: Field;
  private hasher: Hasher;
  private height: number;

  constructor(root: Field, height: number, hasher: Hasher = Poseidon.hash) {
    this.root = root;
    this.nodeStore = new Map<string, Field[]>();
    this.valueStore = new Map<string, Field>();
    this.height = height;
    this.hasher = hasher;
  }

  public getRoot(): Field {
    return this.root;
  }

  public getHeight(): number {
    return this.height;
  }

  public has(path: Field, valueHash: Field): boolean {
    let v = this.valueStore.get(path.toString());
    if (v === undefined || !v.equals(valueHash).toBoolean()) {
      return false;
    }

    return true;
  }

  public addBranch(proof: BaseNumIndexSparseMerkleProof, valueHash: Field) {
    const path = proof.path;

    let { ok, updates } = proof.verifyByFieldWithUpdates(
      this.root,
      valueHash,
      this.hasher
    );

    if (!ok) {
      throw new Error('invalid proof');
    }

    for (let i = 0, len = updates.length; i < len; i++) {
      let v = updates[i];
      this.nodeStore.set(v[0].toString(), v[1]);
    }

    this.valueStore.set(path.toString(), valueHash);
  }

  public prove(path: Field): BaseNumIndexSparseMerkleProof {
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

    class InnerNumIndexSparseMerkleProof extends NumIndexSparseMerkleProof(
      this.height
    ) {}

    return new InnerNumIndexSparseMerkleProof(this.root, path, sideNodes);
  }

  public update(path: Field, valueHash: Field): Field {
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

    let currentHash = valueHash;
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

    this.valueStore.set(path.toString(), valueHash);
    this.root = currentHash;

    return this.root;
  }
}

function verifyProofWithUpdates(
  proof: SparseMerkleProof,
  expectedRoot: Field,
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): { ok: boolean; updates: [Field, Field[]][] } {
  if (!proof.root.equals(expectedRoot).toBoolean()) {
    return { ok: false, updates: [] };
  }

  const { actualRoot, updates } = computeRoot(
    proof.sideNodes,
    keyHash,
    valueHash,
    hasher
  );

  return { ok: actualRoot.equals(expectedRoot).toBoolean(), updates };
}

function computeRoot(
  sideNodes: Field[],
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): { actualRoot: Field; updates: [Field, Field[]][] } {
  let currentHash: Field = valueHash;

  const pathBits = keyHash.toBits(SMT_DEPTH);
  let updates: [Field, Field[]][] = [];

  updates.push([currentHash, [currentHash]]);

  for (let i = SMT_DEPTH - 1; i >= 0; i--) {
    let node = sideNodes[i];

    let currentValue: Field[] = [];
    if (pathBits[i].toBoolean()) {
      currentValue = [node, currentHash];
    } else {
      currentValue = [currentHash, node];
    }
    currentHash = hasher(currentValue);

    updates.push([currentHash, currentValue]);
  }
  return { actualRoot: currentHash, updates };
}
