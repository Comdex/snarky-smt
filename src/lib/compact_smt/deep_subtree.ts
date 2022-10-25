import { Field, Poseidon } from 'snarkyjs';
import { FieldElements } from '../model';
import { Hasher } from '../proofs';
import { Store } from '../store/store';
import { CompactSparseMerkleProof, c_verifyProofWithUpdates } from './proofs';
import { CompactSparseMerkleTree } from './smt';

export { CompactDeepSparseMerkleSubTree };

/**
 * This is used to compute new roots for state transitions based on sideNodes.
 *
 * @export
 * @class CompactSparseMerkleTree
 * @extends {CompactDeepSparseMerkleSubTree<K, V>}
 * @template K
 * @template V
 */
class CompactDeepSparseMerkleSubTree<
  K extends FieldElements,
  V extends FieldElements
> extends CompactSparseMerkleTree<K, V> {
  constructor(
    store: Store<V>,
    root: Field,
    options: { hasher?: Hasher; hashKey?: boolean; hashValue?: boolean } = {
      hasher: Poseidon.hash,
      hashKey: true,
      hashValue: true,
    }
  ) {
    super(store, root, options);
  }

  async addBranch(proof: CompactSparseMerkleProof, key: K, value?: V) {
    const { ok, updates } = c_verifyProofWithUpdates(
      proof,
      this.getRoot(),
      key,
      value,
      {
        hasher: this.th.getHasher(),
        hashKey: this.config.hashKey,
        hashValue: this.config.hashValue,
      }
    );
    if (!ok) {
      throw new Error('Invalid proof');
    }

    if (value !== undefined) {
      let path = null;
      if (this.config.hashKey) {
        path = this.th.path(key);
      } else {
        let keyFields = key.toFields();
        if (keyFields.length > 1) {
          throw new Error(
            `The length of key fields is greater than 1, the key needs to be hashed before it can be processed, option 'hashKey' must be set to true`
          );
        }
        path = keyFields[0];
      }
      this.store.preparePutValue(path, value);
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
