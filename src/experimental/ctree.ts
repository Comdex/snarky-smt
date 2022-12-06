import { Field, isReady, shutdown } from 'snarkyjs';
import { CompactDeepSparseMerkleSubTree } from '../lib/compact_smt/deep_subtree';
import { CompactSparseMerkleTree } from '../lib/compact_smt/csmt';
import { ProvableCSMTUtils } from '../lib/compact_smt/verify_circuit';
import { MemoryStore } from '../lib/store/memory_store';

await isReady;

let tree = new CompactSparseMerkleTree(new MemoryStore<Field>(), Field, Field);

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

let subTree = new CompactDeepSparseMerkleSubTree(
  new MemoryStore<Field>(),
  root,
  Field,
  Field
);
await subTree.addBranch(proof1, Field(1), Field(2));
await subTree.addBranch(proof2, Field(3), Field(4));

let root3 = await subTree.update(Field(1), Field(5));
root3 = await subTree.update(Field(3), Field(7));
console.log('root3: ', root3.toString());

// let updateRoot = ProvableCSMTUtils.computeRoot(
//   proof1.sideNodes,
//   Field(1),
//   Field(5)
// );
// console.log('updateRoot: ', updateRoot.toString());

shutdown();
