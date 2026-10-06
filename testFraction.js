import { parseFraction } from './client/src/utils/fractionParser.js';

const tests = [
  "3",
  "3 1/2",
  "3½",
  "3 ½",
  "3 1/4",
  "1/4",
  "4.5",
  "4 1/3",
  "6 3/8"
];

tests.forEach(t => {
  console.log(t, '->', parseFraction(t));
});
