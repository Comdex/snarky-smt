import { AsFieldElements, Field } from 'snarkyjs';
import { FieldElements } from '../model';
import { Store } from './store';
import OrbitDB from 'orbit-db';
import KeyValueStore from 'orbit-db-kvstore';
import { strToFieldArry } from '../utils';

export class OrbitStore<V extends FieldElements> implements Store<V> {
  protected nodes: KeyValueStore<string>;
  protected leaves: KeyValueStore<string>;

  protected eltTyp: AsFieldElements<V>;

  protected operationCache: {
    type: string;
    kvs: KeyValueStore<string>;
    key: string;
    value?: string;
  }[];

  private constructor(
    nodes: KeyValueStore<string>,
    leaves: KeyValueStore<string>,
    eltTyp: AsFieldElements<V>
  ) {
    this.nodes = nodes;
    this.leaves = leaves;
    this.eltTyp = eltTyp;
    this.operationCache = [];
  }

  public static async create<V extends FieldElements>(
    db: OrbitDB,
    eltTyp: AsFieldElements<V>,
    smtName: string
  ): Promise<OrbitStore<V>> {
    let nodes = await db.keyvalue<string>(smtName);
    await nodes.load();
    let leaves = await db.keyvalue<string>(smtName + '_leaf');
    await leaves.load();

    return new OrbitStore<V>(nodes, leaves, eltTyp);
  }

  public async getNodes(key: Field): Promise<Field[]> {
    const valueStr = this.nodes.get(key.toString());
    return strToFieldArry(valueStr);
  }
  public preparePutNodes(key: Field, value: Field[]): void {
    this.operationCache.push({
      type: 'put',
      kvs: this.nodes,
      key: key.toString(),
      value: value.toString(),
    });
  }
  public prepareDelNodes(key: Field): void {
    this.operationCache.push({
      type: 'del',
      kvs: this.nodes,
      key: key.toString(),
    });
  }
  public async getValue(path: Field): Promise<V> {
    const valueStr = this.leaves.get(path.toString());
    let fs = strToFieldArry(valueStr);
    return this.eltTyp.ofFields(fs);
  }
  public preparePutValue(path: Field, value: V): void {
    const valueStr = value.toFields().toString();
    this.operationCache.push({
      type: 'put',
      kvs: this.leaves,
      key: path.toString(),
      value: valueStr,
    });
  }
  public prepareDelValue(path: Field): void {
    this.operationCache.push({
      type: 'del',
      kvs: this.leaves,
      key: path.toString(),
    });
  }
  public async getRoot(): Promise<Field> {
    const valueStr = await this.nodes.get('root');
    return Field(valueStr);
  }
  public prepareUpdateRoot(root: Field): void {
    this.operationCache.push({
      type: 'put',
      kvs: this.nodes,
      key: 'root',
      value: root.toString(),
    });
  }
  public async commit(): Promise<void> {
    for (let i = 0; i < this.operationCache.length; i++) {
      const v = this.operationCache[i];
      if (v.type === 'put') {
        await v.kvs.put(v.key, v.value!, { pin: true });
      } else {
        // del
        await v.kvs.del(v.key, { pin: true });
      }
    }

    this.clearPrepareOperationCache();
  }

  public clearPrepareOperationCache(): void {
    this.operationCache = [];
  }

  public async clear(): Promise<void> {
    throw new Error('OrbitStore: Method not implemented.');
  }
}
