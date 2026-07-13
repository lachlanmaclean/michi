import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '@/pages/LandingPage';

// Pre-renders the landing page's HTML into dist/index.html at build time, so
// crawlers (and anyone with JS disabled) get the real content immediately
// instead of an empty <div id="root">. React still hydrates this on the
// client for real visitors — this only affects the initial HTML payload.
// The /app route is left as a pure client-rendered shell (no SEO content to
// pre-render there, and pre-rendering an interactive editor buys nothing).
// Run from the repo root (via `node dist-prerender/prerender.mjs`), so the
// dist/ path is resolved relative to the current working directory.
const distIndexPath = path.resolve(process.cwd(), 'dist/index.html');

const html = renderToStaticMarkup(
  createElement(MemoryRouter, { initialEntries: ['/'] }, createElement(LandingPage))
);

const original = readFileSync(distIndexPath, 'utf-8');
const updated = original.replace('<div id="root"></div>', `<div id="root">${html}</div>`);

if (updated === original) {
  throw new Error('prerender: could not find <div id="root"></div> in dist/index.html');
}

writeFileSync(distIndexPath, updated);
console.log('Pre-rendered landing page into dist/index.html');
