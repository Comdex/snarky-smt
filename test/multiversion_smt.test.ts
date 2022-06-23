import { Circuit, Field, isReady, Poseidon, shutdown } from 'snarkyjs';
import { decompactProof, verifyProof } from '../src/lib/proofs';
import { MultiVersionSparseMerkleTree } from '../src/lib/multiversion_smt';
import { MemoryStore } from '../src/lib/store/memory_store';
import {
  verifyProofByFieldInCircuit,
  verifyProofInCircuit,
} from '../src/lib/verify_circuit';
import { SMT_EMPTY_VALUE } from '../src/lib/constant';
import { createEmptyValue } from '../src/lib/utils';

describe('MultiVersionSparseMerkleTree', () => {
  let tree: MultiVersionSparseMerkleTree<Field, Field>;

  beforeAll(async () => {
    await isReady;
  });

  afterAll(() => {
    shutdown();
  });

  beforeEach(async () => {
    tree = await MultiVersionSparseMerkleTree.buildNewTree<Field, Field>(
      new MemoryStore<Field>()
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
      expect(verifyProof(proof, root, keys[i], values[i]));
    }

    const key = Poseidon.hash(keys[0].toFields());
    const nonMembershipProof = await tree.prove(key);
    expect(verifyProof(nonMembershipProof, root, key));
  });

  it('should switch version correctly', async () => {
    let keys: Field[] = [];
    let values: Field[] = [];
    let roots: Field[] = [];
    const updateTimes = 5;

    for (let i = 0; i < updateTimes; i++) {
      const key = Field(Math.floor(Math.random() * 1000000000000));
      const value = Field(Math.floor(Math.random() * 1000000000000));
      keys.push(key);
      values.push(value);
      const root = await tree.update(key, value);
      roots.push(root);
    }

    await tree.delete(keys[0]);
    await tree.setRoot(roots[updateTimes - 1]);

    const value0 = await tree.get(keys[0]);
    expect(value0 !== null && value0.equals(values[0]).toBoolean());

    await tree.setRoot(roots[updateTimes - 2]);
    const lastValue = await tree.get(keys[updateTimes - 1]);
    expect(lastValue === null);
  });

  it('should delete element correctly', async () => {
    const x = Field(1);
    const y = Field(2);
    await tree.update(x, y);
    const root = await tree.delete(x);

    const nonMembershipProof = await tree.prove(x);
    expect(verifyProof(nonMembershipProof, root, x));
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
    const proof = decompactProof(cproof);
    expect(verifyProof(proof, root, x, y));
  });

  it('should verify proof in circuit correctly', async () => {
    const x = Field(7);
    const y = Field(8);
    const z = Poseidon.hash([Field(9)]);
    const root = await tree.update(x, y);

    const cproof = await tree.proveCompact(x);
    const proof = decompactProof(cproof);

    const zproof = await tree.prove(z);

    Circuit.runAndCheck(() => {
      let ok = verifyProofInCircuit(proof, root, x, y, Field);
      ok.assertEquals(true);

      ok = verifyProofInCircuit(
        zproof,
        root,
        z,
        createEmptyValue<Field>(Field),
        Field
      );
      ok.assertEquals(true);

      const xHash = Poseidon.hash([x]);
      const yHash = Poseidon.hash([y]);
      ok = verifyProofByFieldInCircuit(proof, root, xHash, yHash);
      ok.assertEquals(true);

      const zhash = Poseidon.hash([z]);
      ok = verifyProofByFieldInCircuit(zproof, root, zhash, SMT_EMPTY_VALUE);
      ok.assertEquals(true);
    });
  });
});
