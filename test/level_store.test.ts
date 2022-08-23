import { Level } from 'level';
import { Field, isReady, shutdown } from 'snarkyjs';
import { LevelStore } from '../src/lib/store/level_store';

describe('LevelStore', () => {
  let store: LevelStore<Field>;

  // beforeAll(async () => {
  //   await isReady;
  // });

  afterAll(async () => {
    // `shutdown()` internally calls `process.exit()` which will exit the running Jest process early.
    // Specifying a timeout of 0 is a workaround to defer `shutdown()` until Jest is done running all tests.
    // This should be fixed with https://github.com/MinaProtocol/mina/issues/10943
    setTimeout(shutdown, 0);
  });

  beforeEach(async () => {
    await isReady;
    const levelDb = new Level<string, any>('./db');
    store = new LevelStore(levelDb, Field, 'test');
  });

  it('should set, get elements and update root correctly', async () => {
    let keys: Field[] = [];
    let nodes: Field[] = [];
    let paths: Field[] = [];
    let values: Field[] = [];
    const updateTimes = 5;

    for (let i = 0; i < updateTimes; i++) {
      const key = Field(Math.floor(Math.random() * 1000000000000));
      const node = Field(Math.floor(Math.random() * 1000000000000));
      const path = Field(Math.floor(Math.random() * 1000000000000));
      const value = Field(Math.floor(Math.random() * 1000000000000));
      keys.push(key);
      nodes.push(node);
      paths.push(path);
      values.push(value);

      store.preparePutNodes(key, [node]);
      store.preparePutValue(path, value);
    }

    const root = Field(999);
    store.prepareUpdateRoot(root);

    store.prepareDelNodes(keys[0]);
    store.prepareDelValue(paths[0]);

    await store.commit();

    try {
      const nodes0 = await store.getNodes(keys[0]);
      expect(false);
    } catch (err) {
      expect(true);
    }

    try {
      const value0 = await store.getValue(paths[0]);
      expect(false);
    } catch (err) {
      expect(true);
    }

    const nodes1 = await store.getNodes(keys[1]);
    expect(nodes1[0].equals(nodes[1]).toBoolean());

    const value1 = await store.getValue(paths[1]);
    expect(value1.equals(values[1]).toBoolean());

    const updateRoot = await store.getRoot();
    expect(updateRoot.equals(root).toBoolean());
  });
});
