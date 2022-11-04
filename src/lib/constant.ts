import { Field, isReady } from 'snarkyjs';

await isReady;

export const EMPTY_VALUE = Field(0);
export const SMT_DEPTH = 254;
export const RIGHT = true;
export const LEFT = false;
export const ERR_KEY_ALREADY_EMPTY = 'Key already empty';
