/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

// Ant Design is being migrated to @openmetadata/ui-core-components
// (open-metadata/openmetadata-collate#6884). Two rules enforce the ratchet:
//
// - `no-antd-import` reports every imported antd symbol. The existing backlog
//   is frozen in eslint-suppressions.json, so a file's count can only fall:
//   adding a symbol exceeds the suppressed count, and removing one leaves an
//   unused suppression that ESLint fails on until it is pruned.
// - `no-migrated-antd-import` reports components that have reached zero across
//   the app. It is never suppressed, so a migrated component cannot return even
//   in a file that still has other antd imports.
const ANTD_SOURCE = /^(?:antd|@ant-design\/icons)(?:\/|$)/;
const ANTD_SUBPATH = /^antd\/(?:lib|es)\/([a-z-]+)/;

const pascalCase = (name) =>
  name.replace(/(^|-)([a-z])/g, (_match, _dash, letter) =>
    letter.toUpperCase()
  );

// Maps an imported symbol to the antd component it belongs to, so `Tooltip`,
// `TooltipProps` and `antd/lib/tooltip` all count as Tooltip.
function componentOf(source, symbol) {
  const subpath = ANTD_SUBPATH.exec(source);

  if (subpath) {
    return pascalCase(subpath[1]);
  }

  if (source === 'antd' && symbol) {
    return symbol.replace(/Props$/, '');
  }

  return undefined;
}

function specifierName(specifier) {
  if (specifier.type === 'ImportDefaultSpecifier') {
    return 'default';
  }
  if (specifier.type === 'ImportNamespaceSpecifier') {
    return '*';
  }

  const named = specifier.imported ?? specifier.local;

  return named?.name ?? named?.value;
}

// Visits every way a module can depend on antd and calls `report` once per
// imported symbol, so suppression counts track symbols rather than lines.
function antdImportVisitors(report) {
  function declaration(node) {
    const source = node.source?.value;

    if (typeof source !== 'string' || !ANTD_SOURCE.test(source)) {
      return;
    }

    const symbols = node.specifiers?.length
      ? node.specifiers.map(specifierName)
      : [node.type === 'ExportAllDeclaration' ? '*' : undefined];

    symbols.forEach((symbol) => report(node, source, symbol));
  }

  function bareSource(node, source) {
    if (typeof source === 'string' && ANTD_SOURCE.test(source)) {
      report(node, source, undefined);
    }
  }

  return {
    ImportDeclaration: declaration,
    ExportNamedDeclaration: declaration,
    ExportAllDeclaration: declaration,
    ImportExpression: (node) => bareSource(node, node.source.value),
    CallExpression(node) {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        bareSource(node, node.arguments[0]?.value);
      }
    },
    TSImportType(node) {
      const source = node.argument ?? node.source;

      bareSource(node, source?.value ?? source?.literal?.value);
    },
  };
}

const componentsSchema = {
  type: 'object',
  properties: {
    components: { type: 'array', items: { type: 'string' } },
  },
  additionalProperties: false,
};

const noAntdImport = {
  meta: {
    type: 'problem',
    schema: [componentsSchema],
    messages: {
      antdImport:
        "'{{symbol}}' from '{{source}}': new Ant Design usage is not allowed. Use @openmetadata/ui-core-components (icons from @openmetadata/ui-core-components/icons). After removing antd usage, run `yarn lint:src:suppressions`.",
    },
  },
  create(context) {
    // Migrated components are owned by no-migrated-antd-import; skipping them
    // here keeps them out of the suppression baseline.
    const migrated = new Set(context.options[0]?.components ?? []);

    return antdImportVisitors((node, source, symbol) => {
      if (migrated.has(componentOf(source, symbol))) {
        return;
      }

      context.report({
        node,
        messageId: 'antdImport',
        data: { source, symbol: symbol ?? source },
      });
    });
  },
};

const noMigratedAntdImport = {
  meta: {
    type: 'problem',
    schema: [componentsSchema],
    messages: {
      migratedImport:
        "antd '{{component}}' has been fully migrated to @openmetadata/ui-core-components; use the core component instead.",
    },
  },
  create(context) {
    const migrated = new Set(context.options[0]?.components ?? []);

    return antdImportVisitors((node, source, symbol) => {
      const component = componentOf(source, symbol);

      if (migrated.has(component)) {
        context.report({ node, messageId: 'migratedImport', data: { component } });
      }
    });
  },
};

export default {
  rules: {
    'no-antd-import': noAntdImport,
    'no-migrated-antd-import': noMigratedAntdImport,
  },
};
