# snarky-smt

Sparse Merkle Tree for SnarkyJs (existence / non-existence merkle proof).

Please note that since currently snarkyjs does not support dynamic-size arrays and plain if statements, only methods for validating merkle tree proofs and computing new state roots (method name ends with InCircuit) can be executed in zkapps(smart contracts of the mina protocol), other methods need to be executed outside of zkapps.

This article briefly describes this data structure [Whats a sparse merkle tree](https://medium.com/@kelvinfichter/whats-a-sparse-merkle-tree-acda70aeb837)

# Install

```bash
npm install --save snarky-smt
# or with yarn:
yarn add snarky-smt
```

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
  createEmptyValue,
} from 'snarky-smt';

class Account extends CircuitValue {
  @prop address: PublicKey;
  @prop balance: UInt64;
  @prop nonce: UInt32;

  constructor(address: PublicKey, balance: UInt64, nonce: UInt32) {
    super();
    this.address = address;
    this.balance = balance;
    this.nonce = nonce;
  }
}

// create a memory store
let store = new MemoryStore<Field>();
// or create a level db store:
// const levelDb = new Level<string, any>('./db');
// const store = new LevelStore(levelDb, Field, 'test');

let smt = await SparseMerkleTree.buildNewTree<Field, Field>(store);
// or import a tree by store
// smt = await SparseMerkleTree.importTree(store);

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
// erify the compacted Merkle proof
const ok = verifyCompactProof(cproof, root, testKey, testValue);
console.log('ok: ', ok);

// Create a merkle proof for a key against the current root.
const proof = await smt.prove(testKey);

// Note that only methods whose method name ends with InCircuit can run in zkapps (the smart contract of the mina protocol)
// Verify the Merkle proof in zkapps (existence merkle proof), isOk should be true.
let isOk = verifyProofInCircuit(proof, root, testKey, testValue, Field);

// non-existence merkle proof, isOk should be false.
const emptyValue = createEmptyValue(Account);
isOk = verifyProofInCircuit(proof, root, testKey, emptyValue, Field);

let newRoot = computeRootInCircuit(proof.sideNodes, testKey, newValue, Field);
console.log('newRoot: ', newRoot.toString());

// another way to verify
const keyHash = Poseidon.hash([testKey]);
const valueHash = Poseidon.hash([testValue]);
const newValueHash = Poseidon.hash([newValue]);
// existence merkle proof, isOk should be true.
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, valueHash);
// non-existence merkle proof, isOk should be false.
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, SMT_EMPTY_VALUE);
newRoot = computeRootByFieldInCircuit(proof.sideNodes, keyHash, newValueHash);
```

# API Reference

- [API Document](https://comdex.github.io/snarky-smt/)

**Notice** this library hasn't been audited. The API and the format of the proof may be changed in the future as snarkyjs is updated.
Make sure you know what you are doing before using this library.
