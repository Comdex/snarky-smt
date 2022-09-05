import {
  Circuit,
  DeployArgs,
  Field,
  isReady,
  SmartContract,
  Permissions,
  State,
  state,
  Mina,
  PrivateKey,
  Party,
  shutdown,
  method,
} from 'snarkyjs';
import { DeepSparseMerkleSubTree } from '../lib/deep_subtree';
import { SparseMerkleProof } from '../lib/proofs';
import { SparseMerkleTree } from '../lib/smt';
import { MemoryStore } from '../lib/store/memory_store';

await isReady;

const doProofs = true;

class TestZkapp extends SmartContract {
  @state(Field) commitment = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);

    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });

    this.commitment.set(root);
  }

  @method
  merkle(
    proof1: SparseMerkleProof,
    key1: Field,
    value1: Field,
    proof2: SparseMerkleProof,
    key2: Field,
    value2: Field,
    proof3: SparseMerkleProof,
    key3: Field,
    value3: Field
  ) {
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    let tree = new DeepSparseMerkleSubTree<Field, Field>(proof1.root, Field);
    tree.addBranch(proof1, key1, value1);
    tree.addBranch(proof2, key2, value2);
    tree.addBranch(proof3, key3, value3);

    let finalRoot = tree.update(key1, Field(88));
    finalRoot = tree.update(key2, Field(99));
    finalRoot = tree.update(key3, Field(1010));

    Circuit.asProver(() => {
      console.log('finalRoot: ', finalRoot.toString());
    });

    finalRoot.assertEquals(commitment);
  }
}

let local = Mina.LocalBlockchain();
Mina.setActiveInstance(local);
let feePayerKey = local.testAccounts[0].privateKey;
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let tree = await SparseMerkleTree.buildNewTree<Field, Field>(
  new MemoryStore<Field>()
);
const key1 = Field(1);
const value1 = Field(33);
const key2 = Field(2);
const value2 = Field(55);
const key3 = Field(5);
const value3 = Field(9999999);

let root = await tree.update(key1, value1);
root = await tree.update(key2, value2);
root = await tree.update(key3, value3);

console.log('start root: ', root.toString());

let proof1 = await tree.prove(key1);
let proof2 = await tree.prove(key2);
let proof3 = await tree.prove(key3);

root = await tree.update(key1, Field(88));
root = await tree.update(key2, Field(99));
root = await tree.update(key3, Field(1010));
console.log('after root: ', root.toString());

async function test() {
  let zkapp = new TestZkapp(zkappAddress);

  if (doProofs) {
    console.time('compile');
    // let start = new Date().getTime();
    await TestZkapp.compile(zkappAddress);
    // let end = new Date().getTime();
    // console.log('compile end: ', (end - start) / 1000);
    console.timeEnd('compile');
  }

  console.log('deploying');
  let tx = await local.transaction(feePayerKey, () => {
    Party.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey });
  });
  if (doProofs) {
    await tx.prove();
    tx.send();
  } else {
    tx.send();
  }

  console.log('deploy done');

  console.log('start method');
  tx = await local.transaction(feePayerKey, () => {
    zkapp.merkle(
      proof1,
      key1,
      value1,
      proof2,
      key2,
      value2,
      proof3,
      key3,
      value3
    );

    if (!doProofs) {
      zkapp.sign(zkappKey);
    }
  });
  if (doProofs) {
    await tx.prove();
    tx.send();
  } else {
    tx.send();
  }
  console.log('end method');
  shutdown();
}

await test();
