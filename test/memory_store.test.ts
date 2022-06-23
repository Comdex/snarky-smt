import { Field, isReady, shutdown } from 'snarkyjs';
import { MemoryStore } from '../src/lib/store/memory_store';

describe('MemoryStore', () => {
  let store: MemoryStore<Field>;

  beforeAll(async () => {
    await isReady;
  });

  afterAll(() => {
    shutdown();
  });

  beforeEach(async () => {
    store = new MemoryStore<Field>();
  });

  it('should set, get elements and update root correctly', async () => {
    let keys = [];
    let nodes = [];
    let paths = [];
    let values = [];
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
