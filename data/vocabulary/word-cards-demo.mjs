import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const demoWords = require('./word-cards-demo.json');

export default demoWords;
