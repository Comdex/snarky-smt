import { Field, Poseidon } from 'snarkyjs';
import { FieldElements } from '../model';
import { Hasher } from '../proofs';
import { Store } from '../store/store';
import { CSparseMerkleProof, c_verifyProofWithUpdates } from './proofs';
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

  async addBranch(proof: CSparseMerkleProof, key: K, value: V) {
    const { ok, updates } = c_verifyProofWithUpdates(
      proof,
      this.getRoot(),
      key,
      value,
      this.th.getHasher()
    );
    if (!ok) {
      throw new Error('Bad proof');
    }

    if (value !== undefined) {
      //membership proof
      this.store.preparePutValue(this.th.path(key), value);
    }

    updates?.forEach((v: [Field, Field[]]) => {
      this.store.preparePutNodes(v[0], v[1]);
    });

    if (!this.th.isEmptyData(proof.siblingData)) {
      if (proof.sideNodes.length > 0) {
        this.store.preparePutNodes(proof.sideNodes[0], proof.siblingData);
      }
    }

    await this.store.commit();
  }
}
