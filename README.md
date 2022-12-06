# snarky-smt

![npm](https://img.shields.io/npm/v/snarky-smt)
![node-current](https://img.shields.io/node/v/snarky-smt)
![Libraries.io dependency status for latest release](https://img.shields.io/librariesio/release/npm/snarky-smt)
![npm](https://img.shields.io/npm/dm/snarky-smt)

Merkle Tree for SnarkyJs (membership / non-membership merkle proof).

The library contains implementations of sparse merkle tree, merkle tree and compact merkle tree based on snarkyjs, which you can use in the browser or node.js, and provides a corresponding set of verifiable utility methods that can be run in circuits.

**Notice**: Versions starting from 0.6.0 (Structs are officially supported) have a breaking update to the api and are not compatible with previous versions

This article gives a brief introduction to SMT: [Whats a sparse merkle tree](https://medium.com/@kelvinfichter/whats-a-sparse-merkle-tree-acda70aeb837)

## Disclaimer and Notes

The library hasn't been audited. The API and the format of the proof may be changed in the future as snarkyjs is updated.
Make sure you know what you are doing before using this library.

---

## Table of Contents

<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Install](#install)
  - [1. Install module](#1-install-module)
  - [2. Install peer dependencies](#2-install-peer-dependencies)
- [What can you do with this library](#what-can-you-do-with-this-library)
- [Usage](#usage)
  - [Create a merkle tree data store](#create-a-merkle-tree-data-store)
    - [1. Create a memory store](#1-create-a-memory-store)
    - [2. Create a leveldb store](#2-create-a-leveldb-store)
    - [3. Create a rocksdb store](#3-create-a-rocksdb-store)
    - [4. Create a mongodb store](#4-create-a-mongodb-store)
  - [Use MerkleTree (original NumIndexSparseMerkleTree)](#use-merkletree-original-numindexsparsemerkletree)
  - [Use SparseMerkleTree](#use-sparsemerkletree)
  - [Use CompactSparseMerkleTree](#use-compactsparsemerkletree)
- [API Reference](#api-reference)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Install

### 1. Install module

```bash
npm install snarky-smt
```

or with yarn:

```bash
yarn add snarky-smt
```

### 2. Install peer dependencies

```bash
npm install snarkyjs
# yarn add snarkyjs
```

If you need to use LevelDB to store data, you will also need to install:

```bash
npm install level
# yarn add level
```

RocksDB:

```bash
npm install rocksdb encoding-down levelup
```

MongoDB:

```bash
npm install mongoose
```

## What can you do with this library

You can update the data of Sparse Merkle Tree(SMT) outside the circuit, and then verify the membership proof or non-membership proof of the data in the circuit. At the same time, you can also verify the correctness of the state transformation of SMT in the circuit, which makes us not need to update the SMT in the circuit, but also ensure the legal modification of SMT data outside the circuit. We can verify the validity of data modification through zkApp.

---

## Usage

### Create a merkle tree data store

#### 1. Create a memory store

```typescript
import { MemoryStore, Store } from 'snarky-smt';
import { Field } from 'snarkyjs';

// memory data store for Field type data, you can use any CircuitValue from snarkyjs or a custom composite CircuitValue
let store: Store<Field> = new MemoryStore<Field>();
```

#### 2. Create a leveldb store

```typescript
import { Field } from 'snarkyjs';
import { LevelStore, Store } from 'snarky-smt';
import { Level } from 'level';
// create a leveldb data store for Field type data, you can use any CircuitValue from snarkyjs or a custom composite CircuitValue
const levelDb = new Level<string, any>('./db');
let store: Store<Field> = new LevelStore<Field>(levelDb, Field, 'test');
```

#### 3. Create a rocksdb store

```typescript
import { RocksStore, Store } from 'snarky-smt';
import { Field } from 'snarkyjs';
import encode from 'encoding-down';
import rocksdb from 'rocksdb';
import levelup from 'levelup';

const encoded = encode(rocksdb('./rocksdb'));
const db = levelup(encoded);
let store: Store<Field> = new RocksStore<Field>(db, Field, 'test');
```

#### 4. Create a mongodb store

```typescript
import mongoose from 'mongoose';
import { MongoStore, Store } from 'snarky-smt';
import { Field } from 'snarkyjs';

await mongoose.connect('mongodb://localhost/my_database');
let store: Store<Field> = new MongoStore(mongoose.connection, Field, 'test');
```

### Use MerkleTree (original NumIndexSparseMerkleTree)

> MerkleTree is a merkle tree of numerically indexed data that can customize the tree height, this merkel tree is equivalent to a data structure: Map<bigint, Struct>, Struct can be a CircuitValue type in snarkyjs, such as Field, PublicKey, or a custom composite Struct.
> Tree height <= 254, Numeric index <= (2^height-1).

MerkleTreeUtils: A collection of merkle tree utility methods that do not work in circuits.

ProvableMerkleTreeUtils: A collection of merkle tree utility methods that can be verified to work in circuits

An example of using MerkleTree in the mina smart contract, modified from the example in the [snarkyjs official repo](https://github.com/o1-labs/snarkyjs):
[**merkle_zkapp.ts**](./src/examples/merkle_zkapp.ts)

```typescript
class Account extends Struct({
  address: PublicKey,
  balance: UInt64,
  nonce: UInt32,
}) {}

// Create a memory store
let store = new MemoryStore<Account>();
// initialize a new Merkle Tree with height 8
let tree = await MerkleTree.build(store, 8, Account);

let testValue = new Account({
  address: PrivateKey.random().toPublicKey(),
  balance: UInt64.fromNumber(100),
  nonce: UInt32.fromNumber(0),
});

const root = await tree.update(0n, testValue);

// get value
const v = await tree.get(0n);
// support compact merkle proof
const cproof = await tree.proveCompact(0n);
// decompact NumIndexProof
const proof = MerkleTreeUtils.decompactMerkleProof(cproof);
// check membership outside the circuit
const ok = MerkleTreeUtils.checkMembership(proof, root, 0n, testValue, Account);

// check membership in the circuit
ProvableMerkleTreeUtils.checkMembership(
  proof,
  root,
  Field(0n),
  testValue,
  Account
).assertTrue();

testValue.nonce = testValue.nonce.add(1);
// calculate new root in the circuit
const newRoot = ProvableMerkleTreeUtils.computeRoot(
  proof,
  Field(0n),
  testValue,
  Account
);
```

Support DeepMerkleSubTree: DeepMerkleSubTree is a deep sparse merkle subtree for working on only a few leafs.(ProvableDeepMerkleSubTree is a deep subtree version that works in circuit).
[**DeepMerkleSubTree Example**](./src/experimental/merkle_subtree.ts)

### Use SparseMerkleTree

> SparseMerkleTree is a merkle tree with a fixed height of 254, this merkel tree is equivalent to a data structure: Map<Struct,Struct>, Struct can be a CircuitValue type in snarkyjs, such as Field, PublicKey, or a custom composite Struct.

SMTUtils: A collection of sparse merkle tree utility methods that do not work in circuits.

ProvableSMTUtils: A collection of sparse merkle tree utility methods that can be verified to work in circuits

An example of using SparseMerkleTree in the mina smart contract, modified from the example in the [snarkyjs official repo](https://github.com/o1-labs/snarkyjs):
[**smt_zkapp.ts**](./src/examples/smt_zkapp.ts)

```typescript
class Account extends Struct({
  address: PublicKey,
  balance: UInt64,
  nonce: UInt32,
}) {}

// Create a memory store
let store = new MemoryStore<Account>();
// Or create a level db store:
// const levelDb = new Level<string, any>('./db');
// let store = new LevelStore<Account>(levelDb, Account, 'test');

let smt = await SparseMerkleTree.build(store, Field, Account);
// Or import a tree by store
// smt = await SparseMerkleTree.importTree<Field, Account>(store);

let testKey = Field(1);
let testValue = new Account({
  address: PrivateKey.random().toPublicKey(),
  balance: UInt64.fromNumber(100),
  nonce: UInt32.fromNumber(0),
});
let newValue = new Account({
  address: PrivateKey.random().toPublicKey(),
  balance: UInt64.fromNumber(50),
  nonce: UInt32.fromNumber(1),
});

const root = await smt.update(testKey, testValue);
// Create a compacted merkle proof for a key against the current root.
const cproof = await smt.proveCompact(testKey);
// Verify the compacted Merkle proof outside the circuit.
const ok = SMTUtils.verifyCompactProof(
  cproof,
  root,
  testKey,
  Field,
  testValue,
  Account
);
console.log('ok: ', ok);

// Create a merkle proof for a key against the current root.
const proof = await smt.prove(testKey);

// Check membership in the circuit, isOk should be true.
let isOk = ProvableSMTUtils.checkMembership(
  proof,
  root,
  testKey,
  Field,
  testValue,
  Account
);

// Check Non-membership in the circuit, isOk should be false.
isOk = ProvableSMTUtils.checkNonMembership(proof, root, testKey, Field);

// Calculate new root in the circuit
let newRoot = ProvableSMTUtils.computeRoot(
  roof.sideNodes,
  testKey,
  Field,
  newValue,
  Account
);
console.log('newRoot: ', newRoot.toString());
```

Support DeepSparseMerkleSubTree: DeepSparseMerkleSubTree is a deep sparse merkle subtree for working on only a few leafs.(ProvableDeepSparseMerkleSubTree is a deep subtree version that works in circuit).
[**DeepSparseMerkleSubTree Example**](./src/experimental/subtree.ts)

### Use CompactSparseMerkleTree

> CompactSparseMerkleTree is a merkle tree with a fixed height of 254, this merkel tree is equivalent to a data structure: Map<Struct,Struct>, Struct can be a CircuitValue type in snarkyjs, such as Field, PublicKey, or a custom composite Struct. Compared with SparseMerkleTree, its advantage is that it can save storage space, and the operation efficiency of the tree is relatively high, but it is currently impossible to calculate the new root after the state transformation in the circuit.

CSMTUtils: A collection of compact sparse merkle tree utility methods that do not work in circuits.

ProvableCSMTUtils: A collection of compact sparse merkle tree utility methods that can be verified to work in circuits

```typescript
class Account extends Struct({
  address: PublicKey,
  balance: UInt64,
  nonce: UInt32,
}) {}

// Create a memory store
let store = new MemoryStore<Account>();
// Or create a level db store:
// const levelDb = new Level<string, any>('./db');
// let store = new LevelStore<Account>(levelDb, Account, 'test');

let smt = new CompactSparseMerkleTree(store, Field, Account);
// Or import a tree by store
// smt = await CompactSparseMerkleTree.import(store);

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

// Create a merkle proof for a key against the current root.
const proof = await smt.prove(testKey);

// Check membership in circuit, isOk should be true.
let isOk = ProvableCSMTUtils.checkMembership(
  proof,
  root,
  testKey,
  Field,
  testValue,
  Account
);

// Check Non-membership in circuit, isOk should be false.
isOk = ProvableCSMTUtils.checkNonMembership(proof, root, testKey, Field);
```

Support CompactDeepSparseMerkleSubTree: CompactDeepSparseMerkleSubTree is a deep sparse merkle subtree for working on only a few leafs.
[**CompactDeepSparseMerkleSubTree Example**](./src/experimental/ctree.ts)

## API Reference

- [API Document](https://comdex.github.io/snarky-smt/)
