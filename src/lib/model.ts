import { Field } from 'snarkyjs';

export type { Hasher };

type Hasher = (v: Field[]) => Field;
