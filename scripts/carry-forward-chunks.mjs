#!/usr/bin/env node
// Copies the previous releases' content-hashed chunks into dist/ before the
// Pages deploy, so the new release does not delete them.
//
// WHY THIS IS NEEDED. actions/deploy-pages replaces the whole site on every
// deploy, so whatever dist/ contains is the only thing served afterwards.
// remoteEntry.js sits at a stable URL and is overwritten, but a session that
// loaded the OLD entry before the deploy still lazy-loads chunks by the old
// hashed names (heavy.js, the shared-module fallbacks) the first time it needs
// them. Without the old files those loads 404 and that session breaks until the
// user reloads. The platform asks every app to keep its previous releases'
// chunks for this reason.
//
// HOW. Each deploy publishes dist/release-files.json: the hashed .js files
// shipped by this release, plus the lists from the last KEEP-1 releases. This
// script reads the LIVE copy of that file, downloads every listed file that
// dist/ does not already have, and writes the new list. It only ever adds
// files, never overwrites one (equivalent to rsync --ignore-existing): an
// overwrite would put old bytes under a name the new entry pins.
//
// Source maps are not carried: the platform reads them at deploy time, from the
// release being deployed, and the browser never needs them.
//
// Usage: node scripts/carry-forward-chunks.mjs <dist> <live base URL>
import fs from 'node:fs';
import path from 'node:path';

const KEEP = 3; // this release plus the two before it
const MANIFEST = 'release-files.json';

const [distArg, baseArg] = process.argv.slice(2);
if (!distArg || !baseArg) {
  console.error('usage: carry-forward-chunks.mjs <dist> <live base URL>');
  process.exit(2);
}
const dist = path.resolve(distArg);
const base = baseArg.endsWith('/') ? baseArg : baseArg + '/';
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;

// Only hashed chunk names are carried. remoteEntry.js is the stable URL the new
// release overwrites, and a name without a hash could collide with a new file.
const HASHED = /^[\w-]+\.[0-9a-f]{16,}\.js$/;
const SAFE_NAME = /^[\w.-]+$/;

const shipped = fs
  .readdirSync(dist)
  .filter((f) => HASHED.test(f))
  .sort();
const current = { version, files: shipped };

async function readLiveManifest() {
  let res;
  try {
    res = await fetch(base + MANIFEST, { cache: 'no-store' });
  } catch (err) {
    throw new Error(`could not reach ${base}${MANIFEST}: ${err.message}`);
  }
  if (res.status === 404) return null;
  if (!res.ok)
    throw new Error(`${base}${MANIFEST} answered HTTP ${res.status}`);
  const body = await res.json();
  if (!Array.isArray(body.releases))
    throw new Error(`${MANIFEST} has no releases array`);
  return body;
}

const live = await readLiveManifest();
if (!live) {
  // First deploy under this scheme: nothing published lists its files, so
  // there is nothing to carry. The next deploy carries this one.
  console.log(`no live ${MANIFEST}; nothing to carry forward this time`);
}

const previous = (live?.releases ?? [])
  .filter((r) => r && r.version !== version && Array.isArray(r.files))
  .slice(0, KEEP - 1);

let copied = 0;
let present = 0;
const carried = [];
for (const release of previous) {
  // Only what dist/ really holds afterwards is listed again, so a file already
  // gone from the live site is reported once rather than on every deploy.
  const kept = [];
  for (const name of release.files) {
    // The manifest is fetched from the network, so a name is checked before it
    // becomes a path: no separators, no '..', hashed shape only.
    if (!SAFE_NAME.test(name) || !HASHED.test(name)) {
      throw new Error(
        `refusing unexpected file name in live ${MANIFEST}: ${JSON.stringify(name)}`,
      );
    }
    const target = path.join(dist, name);
    if (fs.existsSync(target)) {
      present++;
      kept.push(name);
      continue;
    }
    const res = await fetch(base + name, { cache: 'no-store' });
    if (!res.ok) {
      // Gone from the live site already (a deploy before this scheme, or a
      // manual one). Nothing to carry; say so rather than fail the release.
      console.warn(
        `::warning::${name} (from ${release.version}) is HTTP ${res.status} on the live site; not carried`,
      );
      continue;
    }
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()), {
      flag: 'wx',
    });
    copied++;
    kept.push(name);
  }
  carried.push({ version: release.version, files: kept });
}

const releases = [current, ...carried];
fs.writeFileSync(
  path.join(dist, MANIFEST),
  JSON.stringify({ releases }, null, 2) + '\n',
);
console.log(
  `carried ${copied} chunk(s) from ${previous.map((r) => r.version).join(', ') || 'no earlier release'}` +
    ` (${present} already present); ${MANIFEST} lists ${releases.length} release(s)`,
);
