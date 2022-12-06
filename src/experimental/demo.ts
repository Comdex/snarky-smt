import { Field, isReady, shutdown } from 'snarkyjs';
import { DeepMerkleSubTree } from '../lib/merkle/deep_subtree';
import { MerkleTree } from '../lib/merkle/merkle_tree';
import { MerkleTreeUtils } from '../lib/merkle/proofs';
import { MemoryStore } from '../lib/store/memory_store';
import { printBits } from '../lib/utils';

await isReady;

// printBits(Field(0).toBits(), '0');
// printBits(Field(1).toBits(), '1');
// printBits(Field(2).toBits(), '2');

const treeHeight = 5;
let tree = await MerkleTree.build<Field>(
  new MemoryStore<Field>(),
  treeHeight,
  Field
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

let deepSubTree = new DeepMerkleSubTree(proof1.root, treeHeight, Field);

deepSubTree.addBranch(proof1, key1, value1);
deepSubTree.addBranch(proof2, key2, value2);
deepSubTree.addBranch(proof3, key3, value3);

let finalRoot = deepSubTree.update(key1, Field(88));
let proofTemp = deepSubTree.prove(key2);
let tempOk = MerkleTreeUtils.verifyProof(
  proofTemp,
  finalRoot,
  key2,
  value2,
  Field
);
console.log('tempOk: ', tempOk);

// let proofTemp2 = deepSubTree.prove(Field(10));

finalRoot = deepSubTree.update(key2, Field(99));
finalRoot = deepSubTree.update(key3, Field(1010));

console.log('final root: ', finalRoot.toString());
root.assertEquals(finalRoot);
shutdown();
