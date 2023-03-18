/*
Description: 
This example describes how developers can use Merkle Trees as a basic off-chain storage tool.
zkApps on Mina can only store a small amount of data on-chain, but many use cases require your application to at least reference big amounts of data.
Merkle Trees give developers the power of storing large amounts of data off-chain, but proving its integrity to the on-chain smart contract!
! Unfamiliar with Merkle Trees? No problem! Check out https://blog.ethereum.org/2015/11/15/merkling-in-ethereum/
*/

import {
  AccountUpdate,
  CircuitString,
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
import { SparseMerkleProof } from '../lib/smt/proofs';
import { SparseMerkleTree } from '../lib/smt/smt';
import { ProvableSMTUtils } from '../lib/smt/verify_circuit';
import { MemoryStore } from '../lib/store/memory_store';

await isReady;

const doProofs = true;

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
  addNewAccount(
    name: CircuitString,
    account: Account,
    merkleProof: SparseMerkleProof
  ) {
    // we fetch the on-chain commitment
    let commitment = this.commitment.get();
    this.commitment.assertEquals(commitment);

    // We need to prove that the account is not in Merkle Tree.
    ProvableSMTUtils.checkNonMembership(
      merkleProof,
      commitment,
      name,
      CircuitString
    ).assertTrue();

    // add new account
    let newCommitment = ProvableSMTUtils.computeRoot(
      merkleProof.sideNodes,
      name,
      CircuitString,
      account,
      Account
    );

    this.commitment.set(newCommitment);
  }

  // existence merkle proof
  @method
  guessPreimage(
    guess: Field,
    name: CircuitString,
    account: Account,
    merkleProof: SparseMerkleProof
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
    ProvableSMTUtils.checkMembership(
      merkleProof,
      commitment,
      name,
      CircuitString,
      account,
      Account
    ).assertTrue();

    // we update the account and grant one point!
    let newAccount = account.addPoints(1);

    // we calculate the new Merkle Root, based on the account changes
    let newCommitment = ProvableSMTUtils.computeRoot(
      merkleProof.sideNodes,
      name,
      CircuitString,
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

let store = new MemoryStore<Account>();
let smt = await SparseMerkleTree.build<CircuitString, Account>(
  store,
  CircuitString,
  Account as any
);

const Bob = CircuitString.fromString('Bob');
const Alice = CircuitString.fromString('Alice');
const Charlie = CircuitString.fromString('Charlie');
const Olivia = CircuitString.fromString('Olivia');

let bobAc = new Account({
  publicKey: Local.testAccounts[0].publicKey,
  points: UInt32.from(0),
});
let aliceAc = new Account({
  publicKey: Local.testAccounts[1].publicKey,
  points: UInt32.from(0),
});
let charlieAc = new Account({
  publicKey: Local.testAccounts[2].publicKey,
  points: UInt32.from(0),
});
let oliviaAc = new Account({
  publicKey: Local.testAccounts[3].publicKey,
  points: UInt32.from(2),
});

await smt.update(Bob, bobAc);
await smt.update(Alice, aliceAc);
await smt.update(Charlie, charlieAc);

// now that we got our accounts set up, we need the commitment to deploy our contract!
initialCommitment = smt.getRoot();

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

console.log('Initial points: ' + (await smt.get(Bob))?.points);

console.log('Making guess..');
await makeGuess(Bob, 22);

console.log('Final points: ' + (await smt.get(Bob))?.points);

await addNewAccount(Olivia, oliviaAc);

console.log('Final Olivia points: ' + (await smt.get(Olivia))?.points);

shutdown();

async function addNewAccount(name: CircuitString, account: Account) {
  let merkleProof = await smt.prove(name);

  let tx = await Mina.transaction(feePayer, () => {
    leaderboardZkApp.addNewAccount(name, account, merkleProof);
  });
  await tx.prove();
  await tx.sign([feePayerKey]).send();

  await smt.update(name, account!);
  leaderboardZkApp.commitment.get().assertEquals(smt.getRoot());
}

async function makeGuess(name: CircuitString, guess: number) {
  let account = await smt.get(name);

  let merkleProof = await smt.prove(name);

  let tx = await Mina.transaction(feePayer, () => {
    leaderboardZkApp.guessPreimage(Field(guess), name, account!, merkleProof);
  });
  await tx.prove();
  await tx.sign([feePayerKey]).send();

  // if the transaction was successful, we can update our off-chain storage as well
  account!.points = account!.points.add(1);
  await smt.update(name, account!);
  leaderboardZkApp.commitment.get().assertEquals(smt.getRoot());
}
