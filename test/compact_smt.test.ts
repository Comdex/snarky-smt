import { Circuit, Field, isReady, Poseidon, shutdown } from 'snarkyjs';
import { CSMTUtils } from '../src/lib/compact_smt/proofs';
import { CompactSparseMerkleTree } from '../src/lib/compact_smt/csmt';
import { ProvableCSMTUtils } from '../src/lib/compact_smt/verify_circuit';
import { MemoryStore } from '../src/lib/store/memory_store';

describe('CompactSparseMerkleTree', () => {
  let tree: CompactSparseMerkleTree<Field, Field>;

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
    tree = new CompactSparseMerkleTree<Field, Field>(
      new MemoryStore<Field>(),
      Field,
      Field
    );
  });

  it('should create and verify proof correctly', async () => {
    let keys: Field[] = [];
    let values: Field[] = [];
    const updateTimes = 5;

    for (let i = 0; i < updateTimes; i++) {
      const key = Field(Math.floor(Math.random() * 1000000000000));
      const value = Field(Math.floor(Math.random() * 1000000000000));
      keys.push(key);
      values.push(value);
      await tree.update(key, value);
    }

    const root = tree.getRoot();
    for (let i = 0; i < updateTimes; i++) {
      const proof = await tree.prove(keys[i]);
      expect(
        CSMTUtils.checkMemebership(
          proof,
          root,
          keys[i],
          Field,
          values[i],
          Field
        )
      );
    }

    const key = Poseidon.hash(keys[0].toFields());
    const nonMembershipProof = await tree.prove(key);
    expect(CSMTUtils.checkNonMemebership(nonMembershipProof, root, key, Field));
  });

  it('should delete element correctly', async () => {
    const x = Field(1);
    const y = Field(2);
    await tree.update(x, y);
    const root = await tree.delete(x);

    const nonMembershipProof = await tree.prove(x);
    expect(CSMTUtils.checkNonMemebership(nonMembershipProof, root, x, Field));
  });

  it('should get and check element correctly', async () => {
    const x = Field(3);
    const y = Field(4);
    await tree.update(x, y);
    const exist = await tree.has(x);
    expect(exist);

    const element = await tree.get(x);
    expect(element !== null && element.equals(y).toBoolean());
  });

  it('should compact and decompact proof correctly', async () => {
    const x = Field(5);
    const y = Field(6);
    const root = await tree.update(x, y);

    const cproof = await tree.proveCompact(x);
    const proof = CSMTUtils.decompactProof(cproof);

    expect(
      CSMTUtils.checkMemebership<Field, Field>(proof, root, x, Field, y, Field)
    );
  });

  it('should create updatable proof correctly', async () => {
    const x = Field(7);
    const y = Field(8);
    const root = await tree.update(x, y);

    const proof = await tree.proveUpdatable(x);
    const th = tree.getTreeHasher();
    expect(!th.isEmptyData(proof.siblingData));
  });

  function log(...objs: any) {
    Circuit.asProver(() => {
      console.log(objs);
    });
  }

  it('should verify proof in circuit correctly', async () => {
    const x = Field(7);
    const y = Field(8);
    const z = Field(9);
    const root = await tree.update(x, y);
    const cproof = await tree.proveCompact(x);
    const proof = CSMTUtils.decompactProof(cproof);
    const zproof = await tree.prove(z);

    Circuit.runAndCheck(() => {
      ProvableCSMTUtils.checkMembership(
        proof,
        root,
        x,
        Field,
        y,
        Field
      ).assertTrue();
      log('x y membership assert success');

      ProvableCSMTUtils.checkNonMembership(zproof, root, z, Field).assertTrue();
      log('z nonMembership assert success');
    });
  });
});
