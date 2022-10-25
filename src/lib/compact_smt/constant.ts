import { Field, isReady } from 'snarkyjs';

await isReady;

export const PLACEHOLDER = Field(0);
export const CSMT_DEPTH = 254;
export const RIGHT = true;
// compact sparse merkle tree
export const CP_PADD_VALUE = Field.one;
export const ERR_KEY_ALREADY_EMPTY = 'Key already empty';
