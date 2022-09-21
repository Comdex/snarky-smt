import {
  arrayProp,
  AsFieldElements,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  Poseidon,
} from 'snarkyjs';
import { SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import {
  BaseNumIndexSparseMerkleProof,
  Hasher,
  SparseMerkleProof,
} from './proofs';
import { createEmptyValue } from './utils';

export {
  NumIndexDeepSparseMerkleSubTreeForField,
  DeepSparseMerkleSubTree,
  NumIndexDeepSparseMerkleSubTree,
};

class SMTSideNodes extends CircuitValue {
  @arrayProp(Field, SMT_DEPTH) arr: Field[];

  constructor(arr: Field[]) {
    super();
    this.arr = arr;
  }
}

class DeepSparseMerkleSubTree<
  K extends CircuitValue | Field,
  V extends CircuitValue | Field
> {
  private nodeStore: Map<string, Field[]>;
  private valueStore: Map<string, Field>;
  private root: Field;
  private emptyValueOfValueType: V;
  private hasher: Hasher;

  constructor(
    root: Field,
    valueType: AsFieldElements<V>,
    hasher: Hasher = Poseidon.hash
  ) {
    this.root = root;
    this.nodeStore = new Map<string, Field[]>();
    this.valueStore = new Map<string, Field>();
    // @ts-ignore
    this.emptyValueOfValueType = createEmptyValue(valueType);
    this.hasher = hasher;
  }

  public getRoot(): Field {
    return this.root;
  }

  public addBranch(proof: SparseMerkleProof, key: K, value: V) {
    Circuit.asProver(() => {
      const keyHash = this.hasher(key.toFields());
      let valueHash = SMT_EMPTY_VALUE;
      // @ts-ignore
      if (!value.equals(this.emptyValueOfValueType).toBoolean()) {
        valueHash = this.hasher(value.toFields());
      }

      let updates = getUpdatesBySideNodes(
        proof.sideNodes,
        keyHash,
        valueHash,
        SMT_DEPTH,
        this.hasher
      );

      updates.forEach((v: [Field, Field[]]) => {
        this.nodeStore.set(v[0].toString(), v[1]);
      });

      this.valueStore.set(keyHash.toString(), valueHash);
    });
  }

  public update(key: K, value: V): Field {
    const path = this.hasher(key.toFields());
    const pathBits = path.toBits(SMT_DEPTH);

    let sideNodesArr: SMTSideNodes = Circuit.witness(SMTSideNodes, () => {
      let sideNodes: Field[] = [];
      let nodeHash: Field = this.root;

      for (let i = 0; i < SMT_DEPTH; i++) {
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

      return new SMTSideNodes(sideNodes).toConstant();
    });

    let sideNodes = sideNodesArr.arr;

    const oldValueHash = Circuit.witness(Field, () => {
      let oldValueHash = this.valueStore.get(path.toString());
      if (oldValueHash === undefined) {
        throw new Error('oldValueHash does not exist');
      }

      return oldValueHash.toConstant();
    });
    impliedRoot(sideNodes, pathBits, oldValueHash).assertEquals(this.root);

    let currentHash = Circuit.if(
      // @ts-ignore
      value.equals(this.emptyValueOfValueType),
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

class NumIndexDeepSparseMerkleSubTree<V extends CircuitValue | Field> {
  private nodeStore: Map<string, Field[]>;
  private valueStore: Map<string, Field>;
  private root: Field;
  private emptyValueOfValueType: V;
  private hasher: Hasher;

  private height: number;

  constructor(
    root: Field,
    valueType: AsFieldElements<V>,
    height: number,
    hasher: Hasher = Poseidon.hash
  ) {
    this.root = root;
    this.nodeStore = new Map<string, Field[]>();
    this.valueStore = new Map<string, Field>();
    // @ts-ignore
    this.emptyValueOfValueType = createEmptyValue(valueType);
    this.height = height;
    this.hasher = hasher;
  }

  public getRoot(): Field {
    return this.root;
  }

  public addBranch(proof: BaseNumIndexSparseMerkleProof, value: V) {
    Circuit.asProver(() => {
      const keyHash = proof.path;
      let valueHash = SMT_EMPTY_VALUE;
      // @ts-ignore
      if (!value.equals(this.emptyValueOfValueType).toBoolean()) {
        valueHash = this.hasher(value.toFields());
      }

      let updates = getUpdatesBySideNodes(
        proof.sideNodes,
        keyHash,
        valueHash,
        this.height,
        this.hasher
      );

      updates.forEach((v: [Field, Field[]]) => {
        this.nodeStore.set(v[0].toString(), v[1]);
      });

      this.valueStore.set(keyHash.toString(), valueHash);
    });
  }

  public update(path: Field, value: V): Field {
    const pathBits = path.toBits(this.height);

    class SideNodes extends CircuitValue {
      @arrayProp(Field, this.height) arr: Field[];
      constructor(arr: Field[]) {
        super();
        this.arr = arr;
      }
    }

    let fieldArr: SideNodes = Circuit.witness(SideNodes, () => {
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

      return new SideNodes(sideNodes).toConstant();
    });

    let sideNodes = fieldArr.arr;

    const oldValueHash = Circuit.witness(Field, () => {
      let oldValueHash = this.valueStore.get(path.toString());
      if (oldValueHash === undefined) {
        throw new Error('oldValueHash does not exist');
      }
      return oldValueHash.toConstant();
    });
    impliedRootForHeight(
      sideNodes,
      pathBits,
      oldValueHash,
      this.height
    ).assertEquals(this.root);

    let currentHash = Circuit.if(
      // @ts-ignore
      value.equals(this.emptyValueOfValueType),
      SMT_EMPTY_VALUE,
      this.hasher(value.toFields())
    );

    Circuit.asProver(() => {
      this.nodeStore.set(currentHash.toString(), [currentHash, Field.zero]);
    });

    for (let i = this.height - 1; i >= 0; i--) {
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

class NumIndexDeepSparseMerkleSubTreeForField {
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

  public addBranch(proof: BaseNumIndexSparseMerkleProof, valueHash: Field) {
    Circuit.asProver(() => {
      const keyHash = proof.path;

      let updates = getUpdatesBySideNodes(
        proof.sideNodes,
        keyHash,
        valueHash,
        this.height,
        this.hasher
      );

      updates.forEach((v: [Field, Field[]]) => {
        this.nodeStore.set(v[0].toString(), v[1]);
      });

      this.valueStore.set(keyHash.toString(), valueHash);
    });
  }

  public update(path: Field, valueHash: Field): Field {
    const pathBits = path.toBits(this.height);

    class SideNodes extends CircuitValue {
      @arrayProp(Field, this.height) arr: Field[];
      constructor(arr: Field[]) {
        super();
        this.arr = arr;
      }
    }

    let fieldArr: SideNodes = Circuit.witness(SideNodes, () => {
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

      return new SideNodes(sideNodes).toConstant();
    });

    let sideNodes = fieldArr.arr;

    const oldValueHash = Circuit.witness(Field, () => {
      let oldValueHash = this.valueStore.get(path.toString());
      if (oldValueHash === undefined) {
        throw new Error('oldValueHash does not exist');
      }
      return oldValueHash.toConstant();
    });
    impliedRootForHeight(
      sideNodes,
      pathBits,
      oldValueHash,
      this.height
    ).assertEquals(this.root);

    let currentHash = valueHash;

    Circuit.asProver(() => {
      this.nodeStore.set(currentHash.toString(), [currentHash, Field.zero]);
    });

    for (let i = this.height - 1; i >= 0; i--) {
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

function getUpdatesBySideNodes(
  sideNodes: Field[],
  keyHash: Field,
  valueHash: Field,
  height: number = SMT_DEPTH,
  hasher: Hasher = Poseidon.hash
): [Field, Field[]][] {
  let currentHash: Field = valueHash;
  let updates: [Field, Field[]][] = [];

  const pathBits = keyHash.toBits(height);
  updates.push([currentHash, [currentHash]]);

  for (let i = height - 1; i >= 0; i--) {
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

  return updates;
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

function impliedRootForHeight(
  sideNodes: Field[],
  pathBits: Bool[],
  leaf: Field,
  height: number
): Field {
  let impliedRoot = leaf;
  for (let i = height - 1; i >= 0; i--) {
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
