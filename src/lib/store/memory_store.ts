import { Field } from 'snarkyjs';
import { FieldElements } from '../model';
import { Store } from './store';

const enum SetType {
  nodes = 0,
  values = 1,
}

const enum OperationType {
  put = 0,
  del = 1,
}

export class MemoryStore<V extends FieldElements> implements Store<V> {
  private nodesMap: Map<string, Field[]>;
  private valuesMap: Map<string, V>;

  private operationCache: {
    opType: OperationType;
    setType: SetType;
    k: string;
    v: any;
  }[];

  constructor() {
    this.nodesMap = new Map<string, Field[]>();
    this.valuesMap = new Map<string, V>();
    this.operationCache = [];
  }

  clearPrepareOperationCache(): void {
    this.operationCache = [];
  }

  async getRoot(): Promise<Field> {
    const fs = this.nodesMap.get('root');
    if (fs && fs.length == 1) {
      return fs[0];
    } else {
      throw new Error('Root does not exist');
    }
  }

  prepareUpdateRoot(root: Field): void {
    this.operationCache.push({
      opType: OperationType.put,
      setType: SetType.nodes,
      k: 'root',
      v: [root],
    });
  }

  async getNodes(key: Field): Promise<Field[]> {
    let keyStr = key.toString();
    let nodes = this.nodesMap.get(keyStr);
    if (nodes) {
      return nodes;
    } else {
      throw new Error('invalid key: ' + keyStr);
    }
  }

  preparePutNodes(key: Field, value: Field[]): void {
    this.operationCache.push({
      opType: OperationType.put,
      setType: SetType.nodes,
      k: key.toString(),
      v: value,
    });
  }

  prepareDelNodes(key: Field): void {
    this.operationCache.push({
      opType: OperationType.del,
      setType: SetType.nodes,
      k: key.toString(),
      v: undefined,
    });
  }

  async getValue(path: Field): Promise<V> {
    const pathStr = path.toString();
    const v = this.valuesMap.get(pathStr);

    if (v) {
      return v;
    } else {
      throw new Error('invalid key: ' + pathStr);
    }
  }

  preparePutValue(path: Field, value: V): void {
    this.operationCache.push({
      opType: OperationType.put,
      setType: SetType.values,
      k: path.toString(),
      v: value,
    });
  }

  prepareDelValue(path: Field): void {
    this.operationCache.push({
      opType: OperationType.del,
      setType: SetType.values,
      k: path.toString(),
      v: undefined,
    });
  }

  async commit(): Promise<void> {
    for (let i = 0; i < this.operationCache.length; i++) {
      const v = this.operationCache[i];
      if (v.opType === OperationType.put) {
        if (v.setType === SetType.nodes) {
          this.nodesMap.set(v.k, v.v);
        } else {
          this.valuesMap.set(v.k, v.v);
        }
      } else {
        if (v.setType === SetType.nodes) {
          this.nodesMap.delete(v.k);
        } else {
          this.valuesMap.delete(v.k);
        }
      }
    }

    console.log(
      '[commit] current nodes size: ',
      this.nodesMap.size,
      ', current values size: ',
      this.valuesMap.size
    );

    this.clearPrepareOperationCache();
  }

  async clear(): Promise<void> {
    this.nodesMap.clear();
    this.valuesMap.clear();
  }

  async getValuesMap(): Promise<Map<string, V>> {
    return this.valuesMap;
  }
}
