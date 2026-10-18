'use client';

import { defineRegistry } from '@json-render/react';
import { shadcnComponents } from '@json-render/shadcn';
import { studyCatalog } from '@/lib/smart-ui/catalog';

/** Every implementation comes directly from the pinned official package. */
export const { registry } = defineRegistry(studyCatalog, {
  components: shadcnComponents,
});
