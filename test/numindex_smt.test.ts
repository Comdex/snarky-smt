import { Circuit, Field, isReady, Poseidon, shutdown } from 'snarkyjs';
import { SMT_EMPTY_VALUE } from '../src/lib/constant';
import { decompactNumIndexProof } from '../src/lib/proofs';
import { NumIndexSparseMerkleTree } from '../src/lib/numindex_smt';
import { MemoryStore } from '../src/lib/store/memory_store';
import { createEmptyValue } from '../src/lib/utils';

describe('SparseMerkleTree', () => {
  let tree: NumIndexSparseMerkleTree<Field>;

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
    tree = await NumIndexSparseMerkleTree.buildNewTree<Field>(
      new MemoryStore<Field>(),
      8
    );
  });

  it('should create and verify proof correctly', async () => {
    let keys: bigint[] = [];
    let values: Field[] = [];
    const updateTimes = 5;

    for (let i = 0; i < updateTimes; i++) {
      const key = BigInt(i);
      const value = Field(Math.floor(Math.random() * 1000000000000));
      keys.push(key);
      values.push(value);
      await tree.update(key, value);
    }

    const root = tree.getRoot();
    for (let i = 0; i < updateTimes; i++) {
      const proof = await tree.prove(keys[i]);
      expect(proof.verify<Field>(root, values[i]));
    }

    const key = keys[0];
    const nonMembershipProof = await tree.prove(key);
    expect(nonMembershipProof.verify<Field>(root));
  });

  it('should delete element correctly', async () => {
    const x = 1n;
    const y = Field(2);
    await tree.update(x, y);
    const root = await tree.delete(x);

    const nonMembershipProof = await tree.prove(x);
    expect(nonMembershipProof.verify<Field>(root));
  });

  it('should get and check element correctly', async () => {
    const x = 3n;
    const y = Field(4);
    await tree.update(x, y);
    const exist = await tree.has(x);
    expect(exist);

    const element = await tree.get(x);
    expect(element !== null && element.equals(y).toBoolean());
  });

  it('should compact and decompact proof correctly', async () => {
    const x = 5n;
    const y = Field(6);
    const root = await tree.update(x, y);

    const cproof = await tree.proveCompact(x);
    const proof = decompactNumIndexProof(cproof);
    expect(proof.verify<Field>(root, y));
  });

  it('should verify proof in circuit correctly', async () => {
    const x = 7n;
    const y = Field(8);
    const z = 9n;
    const root = await tree.update(x, y);

    const cproof = await tree.proveCompact(x);
    const proof = decompactNumIndexProof(cproof);

    const zproof = await tree.prove(z);

    Circuit.runAndCheck(() => {
      proof.verifyInCircuit(root, y, Field).assertTrue();

      zproof.verifyInCircuit(root, createEmptyValue(Field), Field).assertTrue();

      const yHash = Poseidon.hash([y]);
      proof.verifyByFieldInCircuit(root, yHash).assertTrue();

      zproof.verifyByFieldInCircuit(root, SMT_EMPTY_VALUE).assertTrue();
    });
  });
});
