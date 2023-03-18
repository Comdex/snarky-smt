/*
Description: 
This example describes how developers can use Merkle Trees as a basic off-chain storage tool.
zkApps on Mina can only store a small amount of data on-chain, but many use cases require your application to at least reference big amounts of data.
Merkle Trees give developers the power of storing large amounts of data off-chain, but proving its integrity to the on-chain smart contract!
! Unfamiliar with Merkle Trees? No problem! Check out https://blog.ethereum.org/2015/11/15/merkling-in-ethereum/
*/

import {
  AccountUpdate,
  DeployArgs,
  Field,
  isReady,
  method,
  Mina,
  Permissions,
  Poseidon,
  PrivateKey,
  PublicKey,
  shutdown,
  SmartContract,
  State,
  state,
  Struct,
  UInt32,
  UInt64,
} from 'snarkyjs';
import { MerkleTree } from '../lib/merkle/merkle_tree';
import { ProvableMerkleTreeUtils } from '../lib/merkle/verify_circuit';
import { MemoryStore } from '../lib/store/memory_store';

await isReady;

const doProofs = true;

class MerkleProof extends ProvableMerkleTreeUtils.MerkleProof(8) {}

class Account extends Struct({ publicKey: PublicKey, points: UInt32 }) {
  addPoints(n: number): Account {
    return new Account({
      publicKey: this.publicKey,
      points: this.points.add(n),
    });
  }
}

// we need the initiate tree root in order to tell the contract about our off-chain storage
let initialCommitment: Field = Field(0);
/*
    We want to write a smart contract that serves as a leaderboard,
    but only has the commitment of the off-chain storage stored in an on-chain variable.
    The accounts of all participants will be stored off-chain!
    If a participant can guess the preimage of a hash, they will be granted one point :)
  */

class Leaderboard extends SmartContract {
  // a commitment is a cryptographic primitive that allows us to commit to data, with the ability to "reveal" it later
  @state(Field) commitment = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });

    this.commitment.set(initialCommitment);
  }

  // If an account with this name does not exist, it is added as a new account (non-existence merkle proof)
  @method
  addNewAccount(index: Field, account: Account, proof: MerkleProof) {
    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // We need to prove that the numerically indexed account does not exist in the merkle tree.
    ProvableMerkleTreeUtils.checkNonMembership(
      proof,
      commitment,
      index
    ).assertTrue();

    // Add a new account under the same numeric index.
    let newCommitment = ProvableMerkleTreeUtils.computeRoot(
      proof,
      index,
      account,
      Account
    );
    this.commitment.set(newCommitment);
  }

  @method
  guessPreimage(
    guess: Field,
    index: Field,
    account: Account,
    proof: MerkleProof
  ) {
    // this is our hash! its the hash of the preimage "22", but keep it a secret!
    let target = Field(
      '17057234437185175411792943285768571642343179330449434169483610110583519635705'
    );
    // if our guess preimage hashes to our target, we won a point!
    Poseidon.hash([guess]).assertEquals(target);

    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // we check that the account is within the committed Merkle Tree
    ProvableMerkleTreeUtils.checkMembership(
      proof,
      commitment,
      index,
      account,
      Account
    ).assertTrue();

    // we update the account and grant one point!
    let newAccount = account.addPoints(1);

    // we calculate the new Merkle Root, based on the account changes
    let newCommitment = ProvableMerkleTreeUtils.computeRoot(
      proof,
      index,
      newAccount,
      Account
    );

    this.commitment.set(newCommitment);
  }
}

let Local = Mina.LocalBlockchain({ proofsEnabled: doProofs });
Mina.setActiveInstance(Local);

let feePayer = Local.testAccounts[0].publicKey;
let feePayerKey = Local.testAccounts[0].privateKey;

// the zkapp account
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

let bob = new Account({
  publicKey: Local.testAccounts[0].publicKey,
  points: UInt32.from(0),
});
let alice = new Account({
  publicKey: Local.testAccounts[1].publicKey,
  points: UInt32.from(0),
});
let charlie = new Account({
  publicKey: Local.testAccounts[2].publicKey,
  points: UInt32.from(0),
});
let olivia = new Account({
  publicKey: Local.testAccounts[3].publicKey,
  points: UInt32.from(5),
});

// we now need "wrap" the Merkle tree around our off-chain storage
// we initialize a new Merkle Tree with height 8
let store = new MemoryStore<Account>();
let tree = await MerkleTree.build<Account>(store, 8, Account as any);

await tree.update(0n, bob);
await tree.update(1n, alice);
await tree.update(2n, charlie);
// await tree.update(3n, olivia);

// now that we got our accounts set up, we need the commitment to deploy our contract!
initialCommitment = tree.getRoot();
console.log('initialCommitment: ', initialCommitment.toString());

let leaderboardZkApp = new Leaderboard(zkappAddress);
console.log('Deploying leaderboard..');
if (doProofs) {
  await Leaderboard.compile();
}
let tx = await Mina.transaction(feePayer, () => {
  AccountUpdate.fundNewAccount(feePayer);
  leaderboardZkApp.deploy({ zkappKey });
});
await tx.prove();
await tx.sign([feePayerKey]).send();

console.log('Initial points: ' + (await tree.get(0n))?.points);

console.log('Making guess..');
await makeGuess(0n, 22);

console.log('Final points: ' + (await tree.get(0n))?.points);

await addNewAccount(3n, olivia);

console.log('Final Olivia points: ' + (await tree.get(3n))?.points);

shutdown();

async function addNewAccount(index: bigint, account: Account) {
  let merkleProof = await tree.prove(index);

  let tx = await Mina.transaction(feePayer, () => {
    leaderboardZkApp.addNewAccount(Field(index), account, merkleProof);
  });
  await tx.prove();
  await tx.sign([feePayerKey]).send();

  await tree.update(index, account!);
  leaderboardZkApp.commitment.get().assertEquals(tree.getRoot());
}

async function makeGuess(index: bigint, guess: number) {
  let account = await tree.get(index);
  let proof = await tree.prove(index);
  console.log('proof root: ', proof.root.toString());

  console.log('proof height: ', proof.height());

  let tx = await Mina.transaction(feePayer, () => {
    leaderboardZkApp.guessPreimage(Field(guess), Field(index), account!, proof);
  });

  await tx.prove();

  await tx.sign([feePayerKey]).send();

  // if the transaction was successful, we can update our off-chain storage as well
  account!.points = account!.points.add(1);
  await tree.update(index, account!);
  console.log('final tree root: ', tree.getRoot().toString());
  leaderboardZkApp.commitment.get().assertEquals(tree.getRoot());
}
