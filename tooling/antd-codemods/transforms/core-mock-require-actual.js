'use strict';

/**
 * Makes `jest.mock('@openmetadata/ui-core-components', factory)` fall through
 * to the real module for anything the factory does not override.
 *
 * A factory mock replaces the module *wholesale*, so any export the factory
 * omits comes back `undefined`. That turns every component sweep into a
 * tripwire: Typography and Button happened to already be listed in these
 * mocks, but the layout sweep introduces `Grid`/`Box`, and `Grid.Item` then
 * throws "Cannot read properties of undefined (reading 'Item')" - 416 times
 * across 22 suites on the first run.
 *
 * Spreading `jest.requireActual` first keeps every explicit override intact
 * while letting unlisted exports resolve to the real implementation, so future
 * sweeps stop breaking unrelated tests.
 *
 * jscodeshift -t transforms/core-mock-require-actual.js <path> --parser=tsx
 */

const CORE_MODULE = '@openmetadata/ui-core-components';

module.exports = function transform(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let changed = false;

  root
    .find(j.CallExpression, {
      callee: {
        type: 'MemberExpression',
        object: { type: 'Identifier', name: 'jest' },
        property: { type: 'Identifier', name: 'mock' },
      },
    })
    .forEach((path) => {
      const [moduleArg, factory] = path.node.arguments;

      const isCore =
        moduleArg &&
        (moduleArg.type === 'StringLiteral' || moduleArg.type === 'Literal') &&
        moduleArg.value === CORE_MODULE;

      if (!isCore || !factory) {
        return;
      }
      if (
        factory.type !== 'ArrowFunctionExpression' &&
        factory.type !== 'FunctionExpression'
      ) {
        return;
      }

      // Locate the object literal the factory returns, in either shape:
      //   () => ({ ... })        - expression body
      //   () => { return {...} } - block body
      let obj = null;
      if (factory.body.type === 'ObjectExpression') {
        obj = factory.body;
      } else if (factory.body.type === 'BlockStatement') {
        const ret = factory.body.body.find(
          (s) => s.type === 'ReturnStatement' && s.argument
        );
        if (ret && ret.argument.type === 'ObjectExpression') {
          obj = ret.argument;
        }
      }

      if (!obj) {
        return;
      }

      // Already spreading requireActual for this module - leave it alone.
      const alreadySpread = obj.properties.some((p) => {
        if (p.type !== 'SpreadElement' && p.type !== 'SpreadProperty') {
          return false;
        }
        const a = p.argument;

        return (
          a &&
          a.type === 'CallExpression' &&
          a.callee.type === 'MemberExpression' &&
          a.callee.object.name === 'jest' &&
          a.callee.property.name === 'requireActual'
        );
      });

      if (alreadySpread) {
        return;
      }

      const spread = j.spreadElement(
        j.callExpression(
          j.memberExpression(
            j.identifier('jest'),
            j.identifier('requireActual')
          ),
          [j.stringLiteral(CORE_MODULE)]
        )
      );

      // First position: explicit overrides that follow must still win.
      obj.properties.unshift(spread);
      changed = true;
    });

  return changed ? root.toSource({ quote: 'single' }) : fileInfo.source;
};

module.exports.parser = 'tsx';
