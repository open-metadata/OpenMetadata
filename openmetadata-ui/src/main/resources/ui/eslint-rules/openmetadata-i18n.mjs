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

/**
 * `no-duplicate-string` — i18n-aware.
 *
 * Wraps `sonarjs/no-duplicate-string` so it behaves identically for real
 * duplicated literals, but never flags i18n translation keys. Those keys
 * (`t('label.…')`) must stay inline: the repo convention keeps `t('key')`
 * literal and the i18n tooling reads those keys from source, so hoisting them
 * into constants is not allowed. `sonarjs/no-duplicate-string` cannot
 * context-ignore `t()` arguments, so this rule filters them out — a duplicate
 * is ignored when the literal is passed as the first argument of `t(...)` or
 * begins with a known i18n namespace (`label.` / `message.` / `server.`).
 */
import sonarjs from 'eslint-plugin-sonarjs';

const baseRule = sonarjs.rules['no-duplicate-string'];
const I18N_KEY_PREFIX = /^(label|message|server)\./;

function isI18nKeyLiteral(node) {
  if (!node || node.type !== 'Literal' || typeof node.value !== 'string') {
    return false;
  }

  if (I18N_KEY_PREFIX.test(node.value)) {
    return true;
  }

  const { parent } = node;

  if (
    parent &&
    parent.type === 'CallExpression' &&
    parent.arguments[0] === node
  ) {
    const { callee } = parent;

    if (callee.type === 'Identifier' && callee.name === 't') {
      return true;
    }

    if (
      callee.type === 'MemberExpression' &&
      callee.property &&
      callee.property.type === 'Identifier' &&
      callee.property.name === 't'
    ) {
      return true;
    }
  }

  return false;
}

const noDuplicateString = {
  meta: baseRule.meta,
  create(context) {
    // `context.report` is read-only and non-configurable, so it can't be
    // replaced via a Proxy get-trap or plain assignment; shadow it with an own
    // property (defineProperty bypasses the inherited read-only descriptor) on
    // a delegating object that inherits everything else from the real context.
    const wrapped = Object.create(context);

    // Coupling: this filters on `descriptor.node`, which sonarjs 4.2.0's
    // `no-duplicate-string` sets to the duplicated literal. If a future sonarjs
    // upgrade switched to `loc`-only reporting, `node` would be undefined and
    // the filter would pass i18n keys through — but that fails loudly, not
    // silently: every `t('label.…')` would then be reported at `error` and the
    // rule's own unit tests (valid i18n cases) would go red in CI. Re-check this
    // wrapper when bumping `eslint-plugin-sonarjs`.
    Object.defineProperty(wrapped, 'report', {
      configurable: true,
      enumerable: true,
      value: (descriptor) => {
        if (descriptor && isI18nKeyLiteral(descriptor.node)) {
          return undefined;
        }

        return context.report(descriptor);
      },
    });

    return baseRule.create(wrapped);
  },
};

export default {
  rules: {
    'no-duplicate-string': noDuplicateString,
  },
};
