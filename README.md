# snarky-smt

![npm](https://img.shields.io/npm/v/snarky-smt)
![node-current](https://img.shields.io/node/v/snarky-smt)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/snarky-smt)
![npm](https://img.shields.io/npm/dm/snarky-smt)


Sparse Merkle Tree for SnarkyJs (membership / non-membership merkle proof).

Please note that since currently snarkyjs does not support dynamic-size arrays and plain if statements, only methods for validating merkle proofs and computing new state roots (method name ends with InCircuit) can be executed in zkApps (smart contracts of the mina protocol), other methods need to be executed outside of zkApps.

This article briefly describes this data structure [Whats a sparse merkle tree](https://medium.com/@kelvinfichter/whats-a-sparse-merkle-tree-acda70aeb837)

-----------------------------------------

## Table of Contents
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->


- [Install](#install)
  - [1. Install module:](#1-install-module)
  - [2. Install peer dependencies:](#2-install-peer-dependencies)
- [What can you do with this library](#what-can-you-do-with-this-library)
- [Usage](#usage)
  - [Create a merkle tree data store](#create-a-merkle-tree-data-store)
    - [1. Create a memory store](#1-create-a-memory-store)
    - [2. Create a leveldb store](#2-create-a-leveldb-store)
    - [3. Create a rocksdb store](#3-create-a-rocksdb-store)
    - [4. Create a mongodb store](#4-create-a-mongodb-store)
  - [Use NumIndexSparseMerkleTree](#use-numindexsparsemerkletree)
  - [Use SparseMerkleTree](#use-sparsemerkletree)
- [API Reference](#api-reference)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Install

### 1. Install module:

```bash
npm install snarky-smt
```
or with yarn:

```bash
yarn add snarky-smt
```

### 2. Install peer dependencies:

```bash
npm install snarkyjs
# yarn add snarkyjs
```

If you need to use LevelDB to store data, you will also need to install:

```bash
npm install level
# yarn add level
```

If you need to use RocksDB to store data, you will also need to install:

```bash
npm install rocksdb encoding-down levelup
```

If you need to use MongoDB to store data, you will also need to install:

```bash
npm install mongoose
```

## What can you do with this library

You can update the data of Sparse Merkle Tree(SMT) outside the circuit, and then verify the membership proof or non-membership proof of the data in the circuit. At the same time, you can also verify the correctness of the state transformation of SMT in the circuit, which makes us not need to update the SMT in the circuit, but also ensure the legal modification of SMT data outside the circuit. We can verify the validity of data modification through zkApp.

--------------------------------------------------------

## Usage

### Create a merkle tree data store

#### 1. Create a memory store

```typescript
import { MemoryStore, Store } from "snarky-smt";
import { Field } from "snarkyjs";

// memory data store for Field type data, you can use any CircuitValue from snarkyjs or a custom composite CircuitValue
let store: Store<Field> = new MemoryStore<Field>();
```

#### 2. Create a leveldb store

```typescript
import { Field } from "snarkyjs";
import { LevelStore, Store } from "snarky-smt";
import { Level } from "level"; 
// create a leveldb data store for Field type data, you can use any CircuitValue from snarkyjs or a custom composite CircuitValue
const levelDb = new Level<string, any>('./db');
let store: Store<Field> = new LevelStore<Field>(levelDb, Field, 'test');
```

#### 3. Create a rocksdb store

```typescript
import { RocksStore, Store } from "snarky-smt";
import { Field } from "snarkyjs";
import encode from "encoding-down";
import rocksdb from "rocksdb";
import levelup from "levelup";

const encoded = encode(rocksdb('./rocksdb'));
const db = levelup(encoded);
let store: Store<Field> = new RocksStore<Field>(db, Field, 'test');
```

#### 4. Create a mongodb store

```typescript
import mongoose from "mongoose";
import { MongoStore, Store } from "snarky-smt";
import { Field } from "snarkyjs";

await mongoose.connect('mongodb://localhost/my_database');
let store: Store<Field> = new MongoStore(mongoose.connection, Field, 'test');
```

### Use NumIndexSparseMerkleTree

> NumIndexSparseMerkleTree is a sparse merkle tree of numerically indexed data that can customize the tree height, this merkel tree is equivalent to a data structure: Map<bigint,CircuitValue>, CircuitValue can be a CircuitValue type in snarkyjs, such as Field, PublicKey, or a custom composite CircuitValue. The tree height must be less than or equal to 254, the numeric index must be less than or equal to (2^height-1).

An example of using NumIndexSparseMerkleTree in the mina smart contract, modified from the example in the [snarkyjs official repo](https://github.com/o1-labs/snarkyjs): 
[**numindex_merkle_zkapp.ts**](./src/examples/numindex_merkle_zkapp.ts)

```typescript
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
// initialize a new Merkle Tree with height 8
let smt = await NumIndexSparseMerkleTree.buildNewTree<Account>(store, 8);

let testValue = new Account(
  PrivateKey.random().toPublicKey(),
  UInt64.fromNumber(100),
  UInt32.fromNumber(0)
);

const root = await smt.update(0n, testValue);

// support compact merkle proof
const cproof = await smt.proveCompact(0n);
// decompact NumIndexProof
const proof = decompactNumIndexProof(cproof);
// verify the proof outside the circuit
const ok = proof.verify<Account>(root, testValue);

// verify the proof in the circuit
proof
  .verifyByFieldInCircuit(root, Poseidon.hash(testValue.toFields()))
  .assertTrue();

// verify the proof in the circuit(generic method)
proof.verifyInCircuit<Account>(root, testValue, Account).assertTrue();

testValue.nonce = testValue.nonce.add(1);
// calculate new root in the circuit(generic method)
const newRoot = proof.computeRootInCircuit<Account>(testValue, Account);
```

### Use SparseMerkleTree

> SparseMerkleTree is a merkle tree with a fixed height of 254, this merkel tree is equivalent to a data structure: Map<CircuitValue,CircuitValue>, CircuitValue can be a CircuitValue type in snarkyjs, such as Field, PublicKey, or a custom composite CircuitValue.  

An example of using SparseMerkleTree in the mina smart contract, modified from the example in the [snarkyjs official repo](https://github.com/o1-labs/snarkyjs): 
[**merkle_zkapp.ts**](./src/examples/merkle_zkapp.ts)

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

// Note that only methods whose method name ends with InCircuit can run in zkApps (smart contracts of the mina protocol)
// Verify the Merkle proof in zkApps (membership merkle proof), isOk should be true.
let isOk = verifyProofInCircuit(proof, root, testKey, testValue, Account);

// Verify Non-membership merkle proof in circuit, isOk should be false.
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
// Verify membership merkle proof in circuit, isOk should be true.
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, valueHash);
// Verify non-membership merkle proof, isOk should be false.
isOk = verifyProofByFieldInCircuit(proof, root, keyHash, SMT_EMPTY_VALUE);
newRoot = computeRootByFieldInCircuit(proof.sideNodes, keyHash, newValueHash);
```

## API Reference

- [API Document](https://comdex.github.io/snarky-smt/)

**Notice** this library hasn't been audited. The API and the format of the proof may be changed in the future as snarkyjs is updated.
Make sure you know what you are doing before using this library.
