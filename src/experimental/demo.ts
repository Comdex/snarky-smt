import { Field, isReady, Poseidon, shutdown } from 'snarkyjs';
import { NumIndexDeepSparseMerkleSubTreeForField } from '../lib/deep_subtree';
import { NumIndexSparseMerkleTree } from '../lib/numindex_smt';
import { MemoryStore } from '../lib/store/memory_store';
import { printBits } from '../lib/utils';

await isReady;

// printBits(Field(0).toBits(), '0');
// printBits(Field(1).toBits(), '1');
// printBits(Field(2).toBits(), '2');

const treeHeight = 5;
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

let deepSubTree = new NumIndexDeepSparseMerkleSubTreeForField(
  proof1.root,
  treeHeight
);

deepSubTree.addBranch(proof1, Poseidon.hash([value1]));
deepSubTree.addBranch(proof2, Poseidon.hash([value2]));
deepSubTree.addBranch(proof3, Poseidon.hash([value3]));

let finalRoot = deepSubTree.update(proof1.path, Poseidon.hash([Field(88)]));
let proofTemp = deepSubTree.prove(proof2.path);
let tempOk = proofTemp.verify(finalRoot, value2);
console.log('tempOk: ', tempOk);

let proofTemp2 = deepSubTree.prove(Field(10));

finalRoot = deepSubTree.update(proof2.path, Poseidon.hash([Field(99)]));
finalRoot = deepSubTree.update(proof3.path, Poseidon.hash([Field(1010)]));

console.log('final root: ', finalRoot.toString());
shutdown();
