import {
  AsFieldElements,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  Poseidon,
  prop,
} from 'snarkyjs';
import { SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import { Hasher, SparseMerkleProof } from './proofs';
import { createEmptyValue } from './utils';

export { DeepSparseMerkleSubTree };

class FieldPair extends CircuitValue {
  @prop left: Field;
  @prop right: Field;

  constructor(left: Field, right: Field) {
    super();
    this.left = left;
    this.right = right;
  }

  getPair(): Field[] {
    return [this.left, this.right];
  }
}

class DeepSparseMerkleSubTree<
  K extends CircuitValue | Field,
  V extends CircuitValue | Field
> {
  nodeStore: Map<string, Field[]>;
  valueStore: Map<string, Field>;
  root: Field;
  valueType: AsFieldElements<V>;
  hasher: Hasher;

  constructor(
    root: Field,
    valueType: AsFieldElements<V>,
    hasher: Hasher = Poseidon.hash
  ) {
    this.root = root;
    this.nodeStore = new Map<string, Field[]>();
    this.valueStore = new Map<string, Field>();
    this.valueType = valueType;
    this.hasher = hasher;
  }

  addBranch(proof: SparseMerkleProof, key: K, value: V) {
    const keyHash = this.hasher(key.toFields());
    const valueHash = this.hasher(value.toFields());

    const { ok, updates } = sub_verifyProofByFieldWithUpdatesInCircuit(
      proof,
      this.root,
      keyHash,
      valueHash
    );
    ok.assertTrue();

    updates.forEach((v: [Field, Field[]]) => {
      Circuit.asProver(() => {
        this.nodeStore.set(v[0].toString(), v[1]);
      });
    });

    Circuit.asProver(() => {
      this.valueStore.set(keyHash.toString(), valueHash);
    });
  }

  update(key: K, value: V): Field {
    const path = this.hasher(key.toFields());
    const pathBits = path.toBits(SMT_DEPTH);
    let sideNodes: Field[] = [];

    let nodeHash: Field = this.root;

    for (let i = 0; i < SMT_DEPTH; i++) {
      const currentValue = Circuit.witness(FieldPair, () => {
        let fs = this.nodeStore.get(nodeHash.toString())!;
        return new FieldPair(fs[0], fs[1]);
      });

      const [left, right] = Circuit.if(
        pathBits[i],
        [currentValue.left, currentValue.right],
        [currentValue.right, currentValue.left]
      );

      sideNodes.push(left);

      nodeHash = right;
    }

    const oldValueHash = Circuit.witness(Field, () => {
      return this.valueStore.get(path.toString())!;
    });
    impliedRoot(sideNodes, pathBits, oldValueHash).assertEquals(this.root);

    let currentHash = Circuit.if(
      // @ts-ignore
      value.equals(createEmptyValue(this.valueType)),
      SMT_EMPTY_VALUE,
      this.hasher(value.toFields())
    );

    Circuit.asProver(() => {
      this.nodeStore.set(currentHash.toString(), [currentHash, Field.zero]);
    });

    for (let i = SMT_DEPTH - 1; i >= 0; i--) {
      let sideNode = sideNodes[i];

      let currentValue = Circuit.if(
        pathBits[i],
        [sideNode, currentHash],
        [currentHash, sideNode]
      );

      currentHash = this.hasher(currentValue);

      Circuit.asProver(() => {
        this.nodeStore.set(currentHash.toString(), currentValue);
      });
    }

    this.root = currentHash;
    return currentHash;
  }
}

function sub_verifyProofByFieldWithUpdatesInCircuit(
  proof: SparseMerkleProof,
  root: Field,
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): { ok: Bool; updates: [Field, Field[]][] } {
  const rootEqual = proof.root.equals(root);
  const { actualRoot, updates } = sub_computeRootByFieldInCircuit(
    proof.sideNodes,
    keyHash,
    valueHash,
    hasher
  );

  return { ok: rootEqual.and(actualRoot.equals(root)), updates };
}

function sub_computeRootByFieldInCircuit(
  sideNodes: Field[],
  keyHash: Field,
  valueHash: Field,
  hasher: Hasher = Poseidon.hash
): { actualRoot: Field; updates: [Field, Field[]][] } {
  let currentHash: Field = valueHash;

  Field(sideNodes.length).assertEquals(SMT_DEPTH);

  const pathBits = keyHash.toBits(SMT_DEPTH);
  let updates: [Field, Field[]][] = [];

  updates.push([currentHash, [currentHash]]);

  for (let i = SMT_DEPTH - 1; i >= 0; i--) {
    let node = sideNodes[i];

    let currentValue = Circuit.if(
      pathBits[i],
      [node, currentHash],
      [currentHash, node]
    );
    currentHash = hasher(currentValue);

    updates.push([currentHash, currentValue]);
  }
  return { actualRoot: currentHash, updates };
}

function impliedRoot(sideNodes: Field[], pathBits: Bool[], leaf: Field): Field {
  let impliedRoot = leaf;
  for (let i = SMT_DEPTH - 1; i >= 0; i--) {
    let sideNode = sideNodes[i];
    let [left, right] = Circuit.if(
      pathBits[i],
      [sideNode, impliedRoot],
      [impliedRoot, sideNode]
    );
    impliedRoot = Poseidon.hash([left, right]);
  }
  return impliedRoot;
}
