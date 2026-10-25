# Use native TypeScript for UI validation and retain the JavaScript API for tooling

- **Status:** Accepted
- **Revisions:** v1 2026-10-25 (initial)
- **Deciders:** UI maintainers
- **Guard:** UI compiler scripts and core yarn test:native-build
- **Related:** [Microsoft TypeScript](https://github.com/microsoft/typescript-go)

## Context

The native TypeScript compiler reduces UI validation time. Declaration generation,
ESLint and organize-imports still consume the existing TypeScript JavaScript API.
The application production bundler does not require a successful application type
check, and the application and Playwright projects have existing diagnostic backlogs.

## Decision

Both UI packages pin TypeScript 5.9.3 as the canonical JavaScript API dependency and
TypeScript 7.0.2 under the typescript-native alias. Compiler scripts invoke the
native launcher's explicit path. Callers use yarn tsc:check, yarn tsc:playwright or
yarn type-check rather than the ambiguous tsc executable installed by both packages.

The core Vite configuration owns validation and declaration generation together.
Its native no-emit check runs in a sequential post-order buildStart hook after
vite-plugin-dts registers source watch files. The native hook also watches the source
directory and its entries on every build so new roots and roots outside the bundle
graph remain watched after recovery. Registering entries also prevents Rollup from
pruning the declaration plugin's initial root-file watches on later builds. A failed check aborts before output
is written, including on direct Vite builds and watch rebuilds. The CSS closeBundle
hook skips failed builds. Declaration generation retains vite-plugin-dts and its
existing aliases and output layout, with semantic checking disabled only in the
plugin's compiler options because the native gate has already checked the source.

## Consequences

Build and watch callers inherit the same gate without a separate wrapper or trusted
environment flag. Invalid watch builds recover when source is repaired. The focused
build self-check exercises rejection, artifact preservation and watch recovery.
Compiler checks continue to exit nonzero for existing application and Playwright
errors. This decision adds no application type-check requirement to bundling.

The retained TypeScript 5 package supports API consumers; it does not define the
compiler scripts. Editor integration is not automatically reconfigured. Revisit the
dependency split when native TypeScript provides the APIs these tools require.
