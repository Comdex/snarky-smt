import {
  arrayProp,
  Bool,
  Circuit,
  CircuitValue,
  Field,
  Poseidon,
} from 'snarkyjs';
import { EMPTY_VALUE, SMT_DEPTH } from '../constant';
import { FieldElements, Hasher } from '../model';
import { SparseMerkleProof } from './proofs';

export { ProvableDeepSparseMerkleSubTree };

class SMTSideNodes extends CircuitValue {
  @arrayProp(Field, SMT_DEPTH) arr: Field[];

  constructor(arr: Field[]) {
    super();
    this.arr = arr;
  }
}

class ProvableDeepSparseMerkleSubTree<
  K extends FieldElements,
  V extends FieldElements
> {
  private nodeStore: Map<string, Field[]>;
  private valueStore: Map<string, Field>;
  private root: Field;
  private hasher: Hasher;
  private config: { hashKey: boolean; hashValue: boolean };

  constructor(
    root: Field,
    options: { hasher: Hasher; hashKey: boolean; hashValue: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ) {
    this.root = root;
    this.nodeStore = new Map<string, Field[]>();
    this.valueStore = new Map<string, Field>();
    this.hasher = options.hasher;
    this.config = { hashKey: options.hashKey, hashValue: options.hashValue };
  }

  public getRoot(): Field {
    return this.root;
  }

  public getHeight(): number {
    return SMT_DEPTH;
  }

  private getKeyField(key: K): Field {
    let keyFields = key.toFields();
    let keyHashOrKeyField = keyFields[0];
    if (this.config.hashKey) {
      keyHashOrKeyField = this.hasher(keyFields);
    }

    return keyHashOrKeyField;
  }

  private getValueField(value?: V): Field {
    let valueHashOrValueField = EMPTY_VALUE;
    if (value) {
      let valueFields = value.toFields();
      valueHashOrValueField = valueFields[0];
      if (this.config.hashValue) {
        valueHashOrValueField = this.hasher(valueFields);
      }
    }
    return valueHashOrValueField;
  }

  public addBranch(proof: SparseMerkleProof, key: K, value?: V) {
    Circuit.asProver(() => {
      const keyField = this.getKeyField(key);
      const valueField = this.getValueField(value);
      let updates = getUpdatesBySideNodes(
        proof.sideNodes,
        keyField,
        valueField,
        this.hasher
      );

      for (let i = 0, h = updates.length; i < h; i++) {
        let v = updates[i];
        this.nodeStore.set(v[0].toString(), v[1]);
      }

      this.valueStore.set(keyField.toString(), valueField);
    });
  }

  public prove(key: K): SparseMerkleProof {
    return Circuit.witness(SparseMerkleProof, () => {
      const keyField = this.getKeyField(key);
      let pathStr = keyField.toString();
      let valueHash = this.valueStore.get(pathStr);
      if (valueHash === undefined) {
        throw new Error(
          `The DeepSubTree does not contain a branch of the path: ${pathStr}`
        );
      }
      const pathBits = keyField.toBits(this.getHeight());
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

  public update(key: K, value?: V): Field {
    const path = this.getKeyField(key);
    const valueField = this.getValueField(value);

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

    let currentHash = valueField;

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
      this.valueStore.set(path.toString(), valueField);
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

function getUpdatesBySideNodes(
  sideNodes: Field[],
  keyHashOrKeyField: Field,
  valueHashOrValueField: Field,
  hasher: Hasher = Poseidon.hash
): [Field, Field[]][] {
  let currentHash: Field = valueHashOrValueField;
  let updates: [Field, Field[]][] = [];

  const pathBits = keyHashOrKeyField.toBits(SMT_DEPTH);
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

  return updates;
}
