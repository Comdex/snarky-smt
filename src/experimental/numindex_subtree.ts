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
  AccountUpdate,
  shutdown,
  method,
  Poseidon,
} from 'snarkyjs';
import { ProvableNumIndexDeepSparseMerkleSubTree } from '../lib/deep_subtree_circuit';
import { NumIndexSparseMerkleTree } from '../lib/numindex_smt';
import { NumIndexSparseMerkleProof } from '../lib/proofs';
import { MemoryStore } from '../lib/store/memory_store';

await isReady;

const doProofs = true;

const treeHeight = 8;

class MerkleProof extends NumIndexSparseMerkleProof(treeHeight) {}

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
    proof1: MerkleProof,
    value1: Field,
    proof2: MerkleProof,
    value2: Field,
    proof3: MerkleProof,
    value3: Field
  ) {
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    let tree = new ProvableNumIndexDeepSparseMerkleSubTree(
      proof1.root,
      treeHeight
    );
    // let tree = new NumIndexDeepSparseMerkleSubTree<Field>(
    //   proof1.root,
    //   Field,
    //   treeHeight
    // );
    tree.addBranch(proof1, value1);
    tree.addBranch(proof2, value2);
    tree.addBranch(proof3, value3);

    // tree.addBranch(proof1, Poseidon.hash([value1]));
    // tree.addBranch(proof2, Poseidon.hash([value2]));
    // tree.addBranch(proof3, Poseidon.hash([value3]));

    let finalRoot = tree.update(proof1.path, Field(88));
    finalRoot = tree.update(proof2.path, Field(99));
    finalRoot = tree.update(proof3.path, Field(1010));

    // let finalRoot = tree.update(proof1.path, Poseidon.hash([Field(88)]));
    // finalRoot = tree.update(proof2.path, Poseidon.hash([Field(99)]));
    // finalRoot = tree.update(proof3.path, Poseidon.hash([Field(1010)]));

    Circuit.asProver(() => {
      console.log('finalRoot by field: ', finalRoot.toString());
    });

    finalRoot.assertEquals(commitment);
  }
}

let local = Mina.LocalBlockchain();
Mina.setActiveInstance(local);
let feePayerKey = local.testAccounts[0].privateKey;
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let tree = await NumIndexSparseMerkleTree.buildNewTree<Field>(
  new MemoryStore<Field>(),
  treeHeight
);
const key1 = 0n;
const value1 = Field(33);
const key2 = 1n;
const value2 = Field(55);
const key3 = 2n;
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
  let tx = await local.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey });
  });
  if (doProofs) await tx.prove();
  tx.send();

  console.log('deploy done');

  console.log('start method');
  tx = await local.transaction(feePayerKey, () => {
    zkapp.merkle(proof1, value1, proof2, value2, proof3, value3);

    if (!doProofs) zkapp.sign(zkappKey);
  });
  if (doProofs) await tx.prove();
  tx.send();
  console.log('end method');
  shutdown();
}

await test();
