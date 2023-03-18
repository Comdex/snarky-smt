import {
  AccountUpdate,
  Circuit,
  DeployArgs,
  Field,
  isReady,
  method,
  Mina,
  Permissions,
  PrivateKey,
  shutdown,
  SmartContract,
  State,
  state,
} from 'snarkyjs';
import { ProvableDeepSparseMerkleSubTree } from '../lib/smt/deep_subtree_circuit';
import { SparseMerkleProof } from '../lib/smt/proofs';
import { SparseMerkleTree } from '../lib/smt/smt';
import { MemoryStore } from '../lib/store/memory_store';

await isReady;

const doProofs = true;

class TestZkapp extends SmartContract {
  @state(Field) commitment = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);

    this.account.permissions.set({
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

    let tree = new ProvableDeepSparseMerkleSubTree(proof1.root, Field, Field);
    // let keyHash1 = Poseidon.hash([key1]);
    // let valueHash1 = Poseidon.hash([value1]);
    // let keyHash2 = Poseidon.hash([key2]);
    // let valueHash2 = Poseidon.hash([value2]);
    // let keyHash3 = Poseidon.hash([key3]);
    // let valueHash3 = Poseidon.hash([value3]);
    // tree.addBranch(proof1, keyHash1, valueHash1);
    // tree.addBranch(proof2, keyHash2, valueHash2);
    // tree.addBranch(proof3, keyHash3, valueHash3);
    tree.addBranch(proof1, key1, value1);
    tree.addBranch(proof2, key2, value2);
    tree.addBranch(proof3, key3, value3);

    // let finalRoot = tree.update(keyHash1, Poseidon.hash([Field(88)]));
    // finalRoot = tree.update(keyHash2, Poseidon.hash([Field(99)]));
    // finalRoot = tree.update(keyHash3, Poseidon.hash([Field(1010)]));
    let finalRoot = tree.update(key1, Field(88));
    finalRoot = tree.update(key2, Field(99));
    finalRoot = tree.update(key3, Field(1010));

    Circuit.asProver(() => {
      console.log('finalRoot: ', finalRoot.toString());
    });

    finalRoot.assertEquals(commitment);
  }
}

let local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(local);
let feePayer = local.testAccounts[0].publicKey;
let feePayerKey = local.testAccounts[0].privateKey;
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let tree = await SparseMerkleTree.build<Field, Field>(
  new MemoryStore<Field>(),
  Field,
  Field
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
    await TestZkapp.compile();
    console.timeEnd('compile');
  }

  console.log('deploying');
  let tx = await local.transaction(feePayer, () => {
    AccountUpdate.fundNewAccount(feePayer);
    zkapp.deploy({ zkappKey });
  });
  await tx.prove();
  await tx.sign([feePayerKey]).send();

  console.log('deploy done');

  console.log('start method');
  tx = await local.transaction(feePayer, () => {
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
  });
  await tx.prove();
  await tx.sign([feePayerKey]).send();

  console.log('end method');
  shutdown();
}

await test();
