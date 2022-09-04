import { Field, isReady } from 'snarkyjs';
import { CDeepSparseMerkleSubTree } from '../lib/compact_tree/deep_subtree';
import { c_verifyProof } from '../lib/compact_tree/proofs';
import { CSparseMerkleTree } from '../lib/compact_tree/smt';
import { MemoryStore } from '../lib/store/memory_store';
import { printBits } from '../lib/utils';

await isReady;

let tree = new CSparseMerkleTree<Field, Field>(new MemoryStore<Field>());

let root = await tree.update(Field(1), Field(2));
root = await tree.update(Field(3), Field(4));

let proof1 = await tree.proveUpdatable(Field(1));
let proof2 = await tree.proveUpdatable(Field(3));

let root2 = await tree.update(Field(1), Field(5));
root2 = await tree.update(Field(3), Field(7));

console.log('root: ', root.toString());
console.log('root2: ', root2.toString());

// console.log('proof1: ', proof1.toJSON());
// let ok = c_verifyProof(proof1, root, Field(1), Field(2));
// console.log('ok: ', ok);

let subTree = new CDeepSparseMerkleSubTree(new MemoryStore<Field>(), root);
await subTree.addBranch(proof1, Field(1), Field(2));
await subTree.addBranch(proof2, Field(3), Field(4));

let root3 = await subTree.update(Field(1), Field(5));
root3 = await subTree.update(Field(3), Field(7));
console.log('root3: ', root3.toString());
