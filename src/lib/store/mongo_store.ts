import { AsFieldElements, Field } from 'snarkyjs';
import { FieldElements } from '../model';
import { Store } from './store';
import mongoose, { Schema, model, Model } from 'mongoose';
import { strToFieldArry } from '../utils';

export { MongoStore };

interface IKV {
  _id: string;
  value: string;
}

const kvSchema = new Schema<IKV>({
  _id: { type: String, required: true },
  value: { type: String, required: true },
});

/**
 * Store based on MongoDB
 *
 * @export
 * @class MongoStore
 * @implements {Store<V>}
 * @template V
 */
class MongoStore<V extends FieldElements> implements Store<V> {
  protected db: mongoose.Connection;
  protected nodesModel: Model<IKV, {}, {}, {}, any>;
  protected valuesModel: Model<IKV, {}, {}, {}, any>;

  protected nodesOperationCache: any[];
  protected valuesOperationCache: any[];
  protected eltTyp: AsFieldElements<V>;

  /**
   * Creates an instance of MongoStore.
   * @memberof MongoStore
   */
  constructor(
    db: mongoose.Connection,
    eltTyp: AsFieldElements<V>,
    smtName: string
  ) {
    this.db = db;
    this.nodesModel = model<IKV>(smtName, kvSchema);
    this.valuesModel = model<IKV>(smtName + '_leaf', kvSchema);
    this.eltTyp = eltTyp;
    this.nodesOperationCache = [];
    this.valuesOperationCache = [];
  }

  /**
   * Clear all prepare operation cache.
   *
   * @memberof MongoStore
   */
  public clearPrepareOperationCache(): void {
    this.nodesOperationCache = [];
    this.valuesOperationCache = [];
  }

  /**
   * Get the tree root. Error is thrown when the root does not exist.
   *
   * @return {*}  {Promise<Field>}
   * @memberof MongoStore
   */
  public async getRoot(): Promise<Field> {
    const kv = await this.nodesModel.findById('root').exec();
    return Field(kv?.value!);
  }

  /**
   * Prepare update the root. Use the commit() method to actually submit changes.
   *
   * @param {Field} root
   * @memberof MongoStore
   */
  public prepareUpdateRoot(root: Field): void {
    this.nodesOperationCache.push({
      updateOne: {
        filter: { _id: 'root' },
        upsert: true,
        update: { value: root.toString() },
      },
    });
  }

  /**
   * Get nodes for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} key
   * @return {*}  {Promise<Field[]>}
   * @memberof MongoStore
   */
  public async getNodes(key: Field): Promise<Field[]> {
    const kv = await this.nodesModel.findById(key.toString()).exec();

    return strToFieldArry(kv?.value!);
  }

  /**
   * Prepare put nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @param {Field[]} value
   * @memberof MongoStore
   */
  public preparePutNodes(key: Field, value: Field[]): void {
    this.nodesOperationCache.push({
      updateOne: {
        filter: { _id: key.toString() },
        upsert: true,
        update: { value: value.toString() },
      },
    });
  }

  /**
   * Prepare delete nodes for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} key
   * @memberof MongoStore
   */
  public prepareDelNodes(key: Field): void {
    this.nodesOperationCache.push({
      deleteOne: {
        filter: { _id: key.toString() },
      },
    });
  }

  /**
   * Convert value string to a value of FieldElements type.
   *
   * @protected
   * @param {string} valueStr
   * @param {AsFieldElements<V>} eltTyp
   * @return {*}  {V}
   * @memberof MongoStore
   */
  protected strToValue(valueStr: string, eltTyp: AsFieldElements<V>): V {
    let fs = strToFieldArry(valueStr);
    return eltTyp.ofFields(fs);
  }

  /**
   * Get the value for a key. Error is thrown when a key that does not exist is being accessed.
   *
   * @param {Field} path
   * @return {*}  {Promise<V>}
   * @memberof MongoStore
   */
  public async getValue(path: Field): Promise<V> {
    const kv = await this.valuesModel.findById(path.toString()).exec();

    return this.strToValue(kv?.value!, this.eltTyp);
  }

  /**
   * Prepare put the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @param {V} value
   * @memberof MongoStore
   */
  public preparePutValue(path: Field, value: V): void {
    this.valuesOperationCache.push({
      updateOne: {
        filter: { _id: path.toString() },
        upsert: true,
        update: { value: value.toString() },
      },
    });
  }

  /**
   * Prepare delete the value for a key. Use the commit() method to actually submit changes.
   *
   * @param {Field} path
   * @memberof MongoStore
   */
  public prepareDelValue(path: Field): void {
    this.valuesOperationCache.push({
      deleteOne: {
        filter: { _id: path.toString() },
      },
    });
  }

  /**
   * Use the commit() method to actually submit all prepare changes.
   *
   * @return {*}  {Promise<void>}
   * @memberof MongoStore
   */
  public async commit(): Promise<void> {
    await this.db.transaction(async (session) => {
      await this.nodesModel.bulkWrite(this.nodesOperationCache, { session });

      await this.valuesModel.bulkWrite(this.valuesOperationCache, {
        session,
      });
    });

    this.clearPrepareOperationCache();
  }

  /**
   * Clear the store.
   *
   * @return {*}  {Promise<void>}
   * @memberof MongoStore
   */
  public async clear(): Promise<void> {
    await this.nodesModel.deleteMany({}).exec();
    await this.valuesModel.deleteMany({}).exec();
  }

  /**
   * Get values map, key is Field.toString().
   *
   * @return {*}  {Promise<Map<string, V>>}
   * @memberof MongoStore
   */
  public async getValuesMap(): Promise<Map<string, V>> {
    const kvs = await this.valuesModel.find({}).exec();
    let valuesMap = new Map<string, V>();
    kvs.forEach((kv) => {
      valuesMap.set(kv._id, this.strToValue(kv.value, this.eltTyp));
    });

    return valuesMap;
  }
}
