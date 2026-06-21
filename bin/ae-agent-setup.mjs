#!/usr/bin/env node

import { main } from './ae-agent-setup-lib.mjs';

main().catch((err) => {
  console.error(`ERROR: ${err.message}`);
  process.exit(1);
});
