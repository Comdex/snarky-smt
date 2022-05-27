import { Field } from 'snarkyjs';
import { SMT_DEPTH, SMT_EMPTY_VALUE } from './constant';
import { Hasher } from './proofs';

var defaultNodesMap: Map<Hasher, Field[]> = new Map<Hasher, Field[]>();

export function defaultNodes(hasher: Hasher): Field[] {
  let nodes = defaultNodesMap.get(hasher);

  if (nodes === undefined) {
    let nodes = new Array<Field>(SMT_DEPTH + 1);

    let h = SMT_EMPTY_VALUE;
    nodes[SMT_DEPTH] = h;

    for (let i = SMT_DEPTH - 1; i >= 0; i--) {
      const newH = hasher([h, h]);
      nodes[i] = newH;
      h = newH;
    }

    defaultNodesMap.set(hasher, nodes);
    return nodes;
  }

  return nodes;
}
