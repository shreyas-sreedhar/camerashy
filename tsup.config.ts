import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { core: 'src/core.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    minify: true,
    clean: true,
  },
  {
    entry: {
      index: 'src/index.ts',
      react: 'src/react.tsx',
    },
    format: ['cjs', 'esm'],
    dts: true,
    minify: true,
    external: ['react', 'react-dom'],
    banner: {
      js: "'use client';",
    },
  },
]);
