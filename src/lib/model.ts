import { Bool, CircuitValue, Field, Scalar } from 'snarkyjs';

export type { Hasher, FieldElements };

type Hasher = (v: Field[]) => Field;

type FieldElements = CircuitValue | Field | Bool;
