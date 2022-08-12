# snarky-smt

Sparse Merkle Tree for SnarkyJs (existence / non-existence merkle proof).

Please note that since currently snarkyjs does not support dynamic-size arrays and plain if statements, only methods for validating merkle tree proofs and computing new state roots (method name ends with InCircuit) can be executed in zkapps(smart contracts of the mina protocol), other methods need to be executed outside of zkapps.

This article briefly describes this data structure [Whats a sparse merkle tree](https://medium.com/@kelvinfichter/whats-a-sparse-merkle-tree-acda70aeb837)

# Install

1. Install module:

   ```
   npm install snarky-smt
   ```

2. Install peer dependencies:

   ```
   npm install snarkyjs
   // If you need to use LevelDB to store data, you will also need to install:
   npm install level
   ```

# What can you do with this library

You can update the data of Sparse Merkle Tree(SMT) outside the circuit, and then verify the existence proof or non-existence proof of the data in the circuit. At the same time, you can also verify the correctness of the state transformation of SMT in the circuit, which makes us not need to update the SMT in the circuit, but also ensure the legal modification of SMT data outside the circuit. We can verify the validity of data modification through zkapp.

--------------------------------

This is an example of using snarky-smt in the mina smart contract, modified from the example in the [snarkyjs official repo](https://github.com/o1-labs/snarkyjs): 
[**merkle_zkapp.ts**](./src/examples/merkle_zkapp.ts)

# Usage

```typescript
import { Level } from 'level';
import {
  Field,
  Poseidon,
  CircuitValue,
  PrivateKey,
  prop,
  PublicKey,
  UInt32,
  UInt64,
} from 'snarkyjs';
import {
  verifyCompactProof,
  verifyProof,
  SparseMerkleTree,
  LevelStore,
  MemoryStore,
  computeRootByFieldInCircuit,
  computeRootInCircuit,
  verifyProofByFieldInCircuit,
  verifyProofInCircuit,
  SMT_EMPTY_VALUE,
  createEmptyValue
} from 'snarky-smt';

class Account extends CircuitValue {
  @prop address: PublicKey;
  @prop balance: UInt64;
  @prop nonce: UInt32;

  constructor(address: PublicKey, balance: UInt64, nonce: UInt32) {
    super(address, balance, nonce);
    this.address = address;
    this.balance = balance;
    this.nonce = nonce;
  }
}

// Create a memory store
let store = new MemoryStore<Account>();
// Or create a level db store:
// const levelDb = new Level<string, any>('./db');
// let store = new LevelStore<Account>(levelDb, Account, 'test');

let smt = await SparseMerkleTree.buildNewTree<Field, Account>(store);
// Or import a tree by store
// smt = await SparseMerkleTree.importTree<Field, Account>(store);

let testKey = Field(1);
let testValue = new Account(
  PrivateKey.random().toPublicKey(),
  UInt64.fromNumber(100),
  UInt32.fromNumber(0)
);
let newValue = new Account(
  PrivateKey.random().toPublicKey(),
  UInt64.fromNumber(50),
  UInt32.fromNumber(1)
);

const root = await smt.update(testKey, testValue);
// Create a compacted merkle proof for a key against the current root.
const cproof = await smt.proveCompact(testKey);
// Verify the compacted Merkle proof
const ok = verifyCompactProof(cproof, root, testKey, testValue);
console.log('ok: ', ok);

// Create a merkle proof for a key against the current root.
const proof = await smt.prove(testKey);

// Note that only methods whose method name ends with InCircuit can run in zkapps (smart contracts of the mina protocol)
// Verify the Merkle proof in zkapps (existence merkle proof), isOk should be true.
let isOk = verifyProofInCircuit(proof, root, testKey, testValue, Account);

// Non-existence merkle proof, isOk should be false.
isOk = verifyProofInCircuit(proof, root, testKey, createEmptyValue<Account>(Account), Account);

let newRoot = computeRootInCircuit(
  proof.sideNodes,
  testKey,
  newValue,
  Account
);
console.log('newRoot: ', newRoot.toString());

// Another way to verify
const keyHash = Poseidon.hash([testKey]);
const valueHash = Poseidon.hash(testValue.toFields());
const newValueHash = Poseidon.hash(newValue.toFields());
// Existence merkle proof, isOk should be true.
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, valueHash);
// Non-existence merkle proof, isOk should be false.
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, SMT_EMPTY_VALUE);
newRoot = computeRootByFieldInCircuit(proof.sideNodes, keyHash, newValueHash);
```

# API Reference

- [API Document](https://comdex.github.io/snarky-smt/)

**Notice** this library hasn't been audited. The API and the format of the proof may be changed in the future as snarkyjs is updated.
Make sure you know what you are doing before using this library.
