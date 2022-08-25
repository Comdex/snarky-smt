import { Circuit, Field, isReady, Poseidon, shutdown } from 'snarkyjs';
import { CSparseMerkleTree } from '../src/lib/compact_tree/smt';
import { MemoryStore } from '../src/lib/store/memory_store';
import {
  c_decompactProof,
  c_verifyProof,
} from '../src/lib/compact_tree/proofs';
import { c_verifyProofInCircuit } from '../src/lib/compact_tree/verify_circuit';
import { createEmptyValue } from '../src/lib/utils';

describe('CSparseMerkleTree', () => {
  let tree: CSparseMerkleTree<Field, Field>;

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
    tree = new CSparseMerkleTree<Field, Field>(new MemoryStore<Field>());
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
      expect(c_verifyProof<Field, Field>(proof, root, keys[i], values[i]));
    }

    const key = Poseidon.hash(keys[0].toFields());
    const nonMembershipProof = await tree.prove(key);
    expect(c_verifyProof<Field, Field>(nonMembershipProof, root, key));
  });

  it('should delete element correctly', async () => {
    const x = Field(1);
    const y = Field(2);
    await tree.update(x, y);
    const root = await tree.delete(x);

    const nonMembershipProof = await tree.prove(x);
    expect(c_verifyProof<Field, Field>(nonMembershipProof, root, x));
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
    const proof = c_decompactProof(cproof);

    expect(c_verifyProof<Field, Field>(proof, root, x, y));
  });

  it('should create updatable proof correctly', async () => {
    const x = Field(7);
    const y = Field(8);
    const root = await tree.update(x, y);

    const proof = await tree.proveUpdatable(x);
    const th = tree.getTreeHasher();
    expect(!th.isEmptyData(proof.siblingData));
  });

  it('should verify proof in circuit correctly', async () => {
    const x = Field(7);
    const y = Field(8);
    const z = Poseidon.hash([Field(9)]);
    const root = await tree.update(x, y);
    const cproof = await tree.proveCompact(x);
    const proof = c_decompactProof(cproof);
    const zproof = await tree.prove(z);

    Circuit.runAndCheck(() => {
      let ok = c_verifyProofInCircuit<Field, Field>(proof, root, x, y, Field);
      console.log(ok.toString());
      ok.assertEquals(true);

      c_verifyProofInCircuit<Field, Field>(
        zproof,
        root,
        z,
        createEmptyValue<Field>(Field),
        Field
      ).assertTrue();
    });
  });
});
