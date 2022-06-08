import { Field, Poseidon } from 'snarkyjs';
import { FieldElements } from '../model';
import { Hasher } from '../proofs';
import { Store } from '../store/store';
import { CSparseMerkleProof, verifyProofWithUpdates_C } from './proofs';
import { CSparseMerkleTree } from './smt';

/**
 * This is used to compute new roots for state transitions based on sideNodes.
 *
 * @export
 * @class CDeepSparseMerkleSubTree
 * @extends {CSparseMerkleTree<K, V>}
 * @template K
 * @template V
 */
export class CDeepSparseMerkleSubTree<
  K extends FieldElements,
  V extends FieldElements
> extends CSparseMerkleTree<K, V> {
  constructor(store: Store<V>, root: Field, hasher: Hasher = Poseidon.hash) {
    super(store, root, hasher);
  }

  public async addBranch(proof: CSparseMerkleProof, key: K, value: V) {
    const th = this.getTreeHasher();
    const { ok, updates } = verifyProofWithUpdates_C(
      proof,
      this.getRoot(),
      key,
      value,
      th.getHasher()
    );
    if (!ok) {
      throw new Error('Bad proof');
    }

    if (value !== undefined) {
      //membership proof
      this.getStore().preparePutValue(th.path(key), value);
    }

    updates?.forEach((v: [Field, Field[]]) => {
      this.getStore().preparePutNodes(v[0], v[1]);
    });

    if (proof.siblingData.isSome.toBoolean()) {
      if (proof.sideNodes.length > 0) {
        this.getStore().preparePutNodes(
          proof.sideNodes[0],
          proof.siblingData.value.siblingData
        );
      }
    }

    await this.getStore().commit();
  }
}
