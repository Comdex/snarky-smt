# snarky-smt

Sparse Merkle Tree for SnarkyJs (existence / non-existence merkle proof). Note that currently only the methods(methods whose method name ends with InCircuit) of verifying the merkle tree proof and calculating the new state root can be executed in zkapp(the smart contract of the mina protocol), other methods need to be executed outside zkapp.

# Install

```bash
npm install --save snarky-smt
# or with yarn:
yarn add snarky-smt
```

# Usage

```typescript
import { Level } from 'level';
import { Field, Poseidon } from 'snarkyjs';
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
} from 'snarky-smt';

// create a memory store
let store = new MemoryStore<Field>();
// or create a level db store:
// const levelDb = new Level<string, any>('./db');
// const store = new LevelStore(levelDb, Field, 'test');

let smt = await SparseMerkleTree.buildNewTree<Field, Field>(store);
// or import a tree by store
// smt = await SparseMerkleTree.importTree(store);

let testKey = Field(1);
let testValue = Field(2);
let newValue = Field(3);

const root = await smt.update(testKey, testValue);
// Create a compacted merkle proof for a key against the current root.
const cproof = await smt.proveCompact(testKey);
// erify the compacted Merkle proof
const ok = verifyCompactProof(cproof, root, testKey, testValue);
console.log('ok: ', ok);

// Create a merkle proof for a key against the current root.
const proof = await smt.prove(testKey);

// Note that only methods whose method name ends with InCircuit can run in zkapp (the smart contract of the mina protocol)
// Verify the Merkle proof in zkapp
let isOk = verifyProofInCircuit(proof, root, testKey, testValue, Field);
let newRoot = computeRootInCircuit(proof.sideNodes, testKey, newValue, Field);
console.log('newRoot: ', newRoot.toString());

// another way to verify
const keyHash = Poseidon.hash([testKey]);
const valueHash = Poseidon.hash([testValue]);
const newValueHash = Poseidon.hash([newValue]);
// existence merkle proof
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, valueHash);
// non-existence merkle proof
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, SMT_EMPTY_VALUE);
newRoot = computeRootByFieldInCircuit(proof.sideNodes, keyHash, newValueHash);
```

# API Reference

- [More API Document](https://comdex.github.io/snarky-smt/)
