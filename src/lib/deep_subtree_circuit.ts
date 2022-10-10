import {
  arrayProp,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  Poseidon,
} from 'snarkyjs';
import { SMT_DEPTH } from './constant';
import {
  BaseNumIndexSparseMerkleProof,
  getUpdatesBySideNodes,
  Hasher,
  NumIndexSparseMerkleProof,
  SparseMerkleProof,
} from './proofs';

export {
  ProvableDeepSparseMerkleSubTree,
  ProvableNumIndexDeepSparseMerkleSubTree,
};

class SMTSideNodes extends CircuitValue {
  @arrayProp(Field, SMT_DEPTH) arr: Field[];

  constructor(arr: Field[]) {
    super();
    this.arr = arr;
  }
}

class ProvableDeepSparseMerkleSubTree {
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

  public addBranch(proof: SparseMerkleProof, keyHash: Field, valueHash: Field) {
    Circuit.asProver(() => {
      let updates = getUpdatesBySideNodes(
        proof.sideNodes,
        keyHash,
        valueHash,
        SMT_DEPTH,
        this.hasher
      );

      for (let i = 0, h = updates.length; i < h; i++) {
        let v = updates[i];
        this.nodeStore.set(v[0].toString(), v[1]);
      }

      this.valueStore.set(keyHash.toString(), valueHash);
    });
  }

  public prove(keyHash: Field): SparseMerkleProof {
    return Circuit.witness(BaseNumIndexSparseMerkleProof, () => {
      let pathStr = keyHash.toString();
      let valueHash = this.valueStore.get(pathStr);
      if (valueHash === undefined) {
        throw new Error(
          `The DeepSubTree does not contain a branch of the path: ${pathStr}`
        );
      }
      const pathBits = keyHash.toBits(this.getHeight());
      let sideNodes: Field[] = [];
      let nodeHash: Field = this.root;
      for (let i = 0, h = this.getHeight(); i < h; i++) {
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

      return new SparseMerkleProof(sideNodes, this.root).toConstant();
    });
  }

  public update(keyHash: Field, valueHash: Field): Field {
    const path = keyHash;
    const treeHeight = this.getHeight();
    const pathBits = path.toBits(treeHeight);

    let sideNodesArr: SMTSideNodes = Circuit.witness(SMTSideNodes, () => {
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
    impliedRootInCircuit(sideNodes, pathBits, oldValueHash).assertEquals(
      this.root
    );

    let currentHash = valueHash;

    Circuit.asProver(() => {
      this.nodeStore.set(currentHash.toString(), [currentHash]);
    });

    for (let i = this.getHeight() - 1; i >= 0; i--) {
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

    Circuit.asProver(() => {
      this.valueStore.set(path.toString(), valueHash);
    });
    this.root = currentHash;

    return this.root;
  }
}

class ProvableNumIndexDeepSparseMerkleSubTree {
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

      for (let i = 0, h = updates.length; i < h; i++) {
        let v = updates[i];
        this.nodeStore.set(v[0].toString(), v[1]);
      }

      this.valueStore.set(keyHash.toString(), valueHash);
    });
  }

  public prove(path: Field): BaseNumIndexSparseMerkleProof {
    return Circuit.witness(BaseNumIndexSparseMerkleProof, () => {
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

      return new InnerNumIndexSparseMerkleProof(
        this.root,
        path,
        sideNodes
      ).toConstant();
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
    impliedRootForHeightInCircuit(
      sideNodes,
      pathBits,
      oldValueHash,
      this.height
    ).assertEquals(this.root);

    let currentHash = valueHash;

    Circuit.asProver(() => {
      this.nodeStore.set(currentHash.toString(), [currentHash]);
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

    Circuit.asProver(() => {
      this.valueStore.set(path.toString(), valueHash);
    });

    this.root = currentHash;

    return this.root;
  }
}

function impliedRootInCircuit(
  sideNodes: Field[],
  pathBits: Bool[],
  leaf: Field
): Field {
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

function impliedRootForHeightInCircuit(
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
