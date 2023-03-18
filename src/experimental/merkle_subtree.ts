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
import { getProofsEnabled } from 'snarkyjs/dist/node/lib/mina';
import { ProvableDeepMerkleSubTree } from '../lib/merkle/deep_subtree_circuit';
import { MerkleTree } from '../lib/merkle/merkle_tree';
import { ProvableMerkleTreeUtils } from '../lib/merkle/verify_circuit';

import { MemoryStore } from '../lib/store/memory_store';

await isReady;

const doProofs = true;

const treeHeight = 10;

class MerkleProof extends ProvableMerkleTreeUtils.MerkleProof(treeHeight) {}

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
    proof1: MerkleProof,
    index1: Field,
    value1: Field,
    proof2: MerkleProof,
    index2: Field,
    value2: Field,
    proof3: MerkleProof,
    index3: Field,
    value3: Field
  ) {
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    let tree = new ProvableDeepMerkleSubTree(proof1.root, treeHeight, Field);
    // let tree = new NumIndexDeepSparseMerkleSubTree<Field>(
    //   proof1.root,
    //   Field,
    //   treeHeight
    // );
    tree.addBranch(proof1, index1, value1);
    tree.addBranch(proof2, index2, value2);
    tree.addBranch(proof3, index3, value3);

    // tree.addBranch(proof1, Poseidon.hash([value1]));
    // tree.addBranch(proof2, Poseidon.hash([value2]));
    // tree.addBranch(proof3, Poseidon.hash([value3]));

    let finalRoot = tree.update(index1, Field(88));
    finalRoot = tree.update(index2, Field(99));
    finalRoot = tree.update(index3, Field(1010));

    // let finalRoot = tree.update(proof1.path, Poseidon.hash([Field(88)]));
    // finalRoot = tree.update(proof2.path, Poseidon.hash([Field(99)]));
    // finalRoot = tree.update(proof3.path, Poseidon.hash([Field(1010)]));

    Circuit.asProver(() => {
      console.log('finalRoot by field: ', finalRoot.toString());
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

let tree = await MerkleTree.build(new MemoryStore<Field>(), treeHeight, Field);
const key1 = 0n;
const value1 = Field(33);
const key2 = 1n;
const value2 = Field(55);
const key3 = 2n;
const value3 = Field(999);

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
      Field(key1),
      value1,
      proof2,
      Field(key2),
      value2,
      proof3,
      Field(key3),
      value3
    );
  });
  await tx.prove();
  await tx.sign([feePayerKey]).send();
  console.log('end method');
  shutdown();
}

await test();
