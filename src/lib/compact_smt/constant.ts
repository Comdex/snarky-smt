import { Field, isReady } from 'snarkyjs';

await isReady;

export const PLACEHOLDER = Field(0);
export const CSMT_DEPTH = 254;
// compact sparse merkle tree
export const CP_PADD_VALUE = Field(1);
