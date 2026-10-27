# Use native TypeScript for UI validation and retain the JavaScript API for tooling

- **Status:** Accepted
- **Revisions:** v1 2026-10-25 (initial) · v2 2026-10-25 (optional tsrs checks) · v3 2026-10-26 (type compatibility cleanup)
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

Application source must still compile under TypeScript 5.9. Collate copies `src/**`
into its own project and type-checks it with TypeScript 5.9 and its own compiler
options, and the TypeScript 5 standard library types differ from TypeScript 7 (for
example, `IntersectionObserver.scrollMargin` exists only in 7). A fix that only
satisfies TypeScript 7, such as a `satisfies` against a DOM type, can break Collate
without failing any check in this repository; prefer forms both versions accept.

## Amendment: optional tsrs checks

Both UI packages also pin `tsrs@0.18.0-ts7.1.0-dev.20260929` for optional development
checks. The app exposes `tsc:check:tsrs` and `tsc:playwright:tsrs`; core exposes
`type-check:tsrs`. These commands use four checkers and Go file assignment, the
settings validated against the corresponding Microsoft TypeScript 7.1 development
snapshot. App and Playwright tsrs checks keep separate incremental caches under
`node_modules/.cache/tsrs/` so they do not reuse Microsoft's compiler caches.

tsrs remains experimental and can differ from the default TypeScript 7.0 compiler.
Its pinned package provides binaries for Apple Silicon and Linux x64/ARM64 with
GNU or musl, but not Windows or Intel Macs. The default compiler commands and the
core build gate therefore retain Microsoft TypeScript. No check runs both compilers
automatically, and no compiler failure falls back to a successful result.

## Amendment: type compatibility cleanup

The application and Playwright diagnostic backlogs described above are cleared for
both compiler commands. Source roots and strictness remain unchanged; shared API
contracts, callers, fixtures and dependency declarations now agree. Application
bundling still runs separately from application checking.

Both TypeScript generation entry points normalize quicktype interfaces that combine
optional properties with an index signature into intersection types. This preserves
optional workflow filters and string-only map values without changing JSON Schemas.
The generator regression compiles accepted and rejected values from the real schemas.

Core builds use i18next 25 declarations to match react-i18next. The public
translation initializer requires only the resource-registration methods it uses,
with no dependency on their version-specific return value. Its peer range continues
to support i18next 21 hosts such as Collate, alongside i18next 25.
