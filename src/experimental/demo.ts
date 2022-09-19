import { Field, isReady, shutdown } from 'snarkyjs';
import { printBits } from '../lib/utils';

await isReady;

printBits(Field(0).toBits(), '0');
printBits(Field(1).toBits(), '1');
printBits(Field(2).toBits(), '2');

shutdown();
