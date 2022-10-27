import { Field } from 'snarkyjs';
import { SMT_DEPTH, EMPTY_VALUE } from './constant';
import { Hasher } from './model';

export { defaultNodes };

let defaultNodesMap: Map<Hasher, Map<number, Field[]>> = new Map<
  Hasher,
  Map<number, Field[]>
>();

function defaultNodes(hasher: Hasher, treeHeight: number = SMT_DEPTH): Field[] {
  let innerMap: Map<number, Field[]> = defaultNodesMap.get(hasher)!;

  if (innerMap === undefined) {
    innerMap = new Map<number, Field[]>();
  }

  let nodes = innerMap.get(treeHeight);

  if (nodes === undefined) {
    let nodes = new Array<Field>(treeHeight + 1);

    let h = EMPTY_VALUE;
    nodes[treeHeight] = h;

    for (let i = treeHeight - 1; i >= 0; i--) {
      const newH = hasher([h, h]);
      nodes[i] = newH;
      h = newH;
    }

    innerMap.set(treeHeight, nodes);
    defaultNodesMap.set(hasher, innerMap);
    return nodes;
  }

  return nodes;
}
