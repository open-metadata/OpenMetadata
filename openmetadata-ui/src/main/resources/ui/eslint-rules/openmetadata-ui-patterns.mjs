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
 * Rule: no-raw-title-attribute
 * Disallow raw HTML title="" attributes on native JSX elements.
 * Use <Tooltip> from @openmetadata/ui-core-components instead.
 *
 * Only a lowercase JSXIdentifier is a native HTML element. A `title` on a React
 * component — whether a plain identifier (`<Card title=…>`) or a member
 * expression (`<Dialog.Header title=…>`) — is a component prop, not a DOM
 * attribute, so it must NOT be flagged. `<iframe>` is exempt because its title
 * is an accessibility requirement (jsx-a11y/iframe-has-title mandates it), as is
 * the `<title>` element itself (SVG / document head).
 */
const ALLOWED_TITLE_ELEMENTS = new Set(['title', 'iframe']);

const noRawTitleAttribute = {
  meta: {
    messages: {
      noRawTitle:
        'Use <Tooltip> from @openmetadata/ui-core-components instead of raw title="" attributes for consistent tooltip behavior.',
    },
    schema: [],
    type: 'suggestion',
  },
  create(context) {
    return {
      JSXAttribute(node) {
        if (node.name.name !== 'title') {
          return;
        }

        const parent = node.parent;
        if (!parent || parent.type !== 'JSXOpeningElement') {
          return;
        }

        // A member expression (`Dialog.Header`) or namespaced name is always a
        // component — only a bare JSXIdentifier can be a native HTML element.
        if (parent.name.type !== 'JSXIdentifier') {
          return;
        }

        const elementName = parent.name.name;

        // Uppercase = React component (title is a prop); allow-list covers the
        // native elements whose title is legitimate (iframe a11y, <title>).
        if (
          !/^[a-z]/.test(elementName) ||
          ALLOWED_TITLE_ELEMENTS.has(elementName)
        ) {
          return;
        }

        // Skip legacy Ant Design selection items (migrated separately).
        const isLegacyAntd = parent.attributes?.some(
          (attr) =>
            attr.name?.name === 'className' &&
            attr.value?.value?.includes('ant-select-selection-item')
        );
        if (isLegacyAntd) {
          return;
        }

        context.report({ messageId: 'noRawTitle', node });
      },
    };
  },
};

/**
 * Rule: no-non-adaptive-palette
 * Disallow raw Tailwind palette color classes (e.g. `tw:bg-blue-50`,
 * `tw:text-gray-500`, `tw:bg-yellow-50`) in `tw:` class strings. Raw palette
 * classes are STATIC — they do not flip between light and dark, so they show a
 * light color on the dark theme. Use the theme-adapting `utility-*` variant
 * (`tw:bg-utility-blue-50`) or a semantic token (`tw:bg-surface`,
 * `tw:text-tertiary`). See docs/colors.md + the dark-mode guidelines.
 *
 * Exemptions:
 *   - a `dark:` variant token (`tw:dark:bg-blue-500`) is a deliberate dark-only
 *     override — allowed.
 *   - a token already on the `utility-*` scale — allowed.
 *   - `white` / `black` — handled separately (intentional on-fill colors).
 *
 * REPORT-ONLY (no autofix) on purpose: the `ui-checkstyle` gate runs
 * `eslint --fix` and then fails on any resulting diff, so a fixable rule at
 * `warn` would silently rewrite pre-existing violations in files an unrelated
 * PR merely touches and fail its gate. A future promotion to `error` (after the
 * backlog is cleared) can re-add a shade-restricted fixer.
 */

// Every raw Tailwind palette family defined in globals.css (`--color-<family>-<shade>`).
// Listed longest-first so the alternation matches a multi-word family
// (`gray-blue`) before its prefix (`gray`).
const PALETTE_FAMILIES = [
  'visualization-blue',
  'visualization-gray',
  'gray-neutral',
  'gray-modern',
  'green-light',
  'orange-dark',
  'blue-light',
  'blue-dark',
  'gray-blue',
  'gray-cool',
  'gray-iron',
  'gray-true',
  'gray-warm',
  'blue',
  'brand',
  'cyan',
  'error',
  'fuchsia',
  'gray',
  'green',
  'indigo',
  'moss',
  'orange',
  'pink',
  'purple',
  'rose',
  'success',
  'teal',
  'violet',
  'warning',
  'yellow',
];

// The subset with a `--color-utility-<family>-*` ramp, so the migration is a
// straight `utility-` swap; the rest must move to a semantic token.
const UTILITY_FAMILIES = new Set([
  'blue',
  'blue-light',
  'blue-dark',
  'brand',
  'error',
  'fuchsia',
  'gray',
  'gray-blue',
  'green',
  'indigo',
  'orange',
  'orange-dark',
  'pink',
  'purple',
  'success',
  'warning',
  'yellow',
]);

const COLOR_PROP =
  '(?:bg|text|border|border-[trblxyse]|outline|ring|divide|from|via|to|fill|stroke|placeholder|caret|accent|decoration|shadow)';
const SHADE = '(?:25|50|100|200|300|400|500|600|700|800|900|950)';
// Trailing `(?:/\\d{1,3})?` tolerates a Tailwind opacity modifier (`.../20`).
const PALETTE_CORE = new RegExp(
  `^(${COLOR_PROP})-(${PALETTE_FAMILIES.join('|')})-(${SHADE})(?:/\\d{1,3})?$`
);

const noNonAdaptivePalette = {
  meta: {
    messages: {
      rawPalette:
        'Raw palette class "{{cls}}" is static — it does not flip in dark mode. {{suggestion}} See docs/colors.md.',
    },
    schema: [],
    type: 'problem',
  },
  create(context) {
    const classify = (token) => {
      if (!token.startsWith('tw:')) {
        return null;
      }
      const segments = token.slice(3).split(':');
      const utility = segments[segments.length - 1];
      const variants = segments.slice(0, -1);
      // A `dark:` override is a deliberate dark-only value; a `utility-` class
      // already adapts. Neither is a bug.
      if (variants.includes('dark') || utility.includes('utility-')) {
        return null;
      }
      const m = PALETTE_CORE.exec(utility);
      if (!m) {
        return null;
      }
      const [, prop, family, shade] = m;
      const suggestion = UTILITY_FAMILIES.has(family)
        ? `Use the theme-adapting "utility-" variant (tw:${prop}-utility-${family}-${shade}) or a semantic token (bg-surface, text-tertiary, …).`
        : 'Use a semantic token (bg-surface, text-tertiary, …); this family has no utility- ramp.';

      return { token, suggestion };
    };

    const checkString = (node, raw) => {
      const offenders = raw.split(/\s+/).map(classify).filter(Boolean);
      if (offenders.length === 0) {
        return;
      }
      context.report({
        node,
        messageId: 'rawPalette',
        data: {
          cls: offenders.map((o) => o.token).join(', '),
          suggestion: offenders[0].suggestion,
        },
      });
    };

    return {
      Literal(node) {
        if (typeof node.value === 'string' && node.value.includes('tw:')) {
          checkString(node, node.value);
        }
      },
      TemplateElement(node) {
        const raw = node.value.cooked ?? node.value.raw;
        if (typeof raw === 'string' && raw.includes('tw:')) {
          checkString(node, raw);
        }
      },
    };
  },
};

export default {
  rules: {
    'no-raw-title-attribute': noRawTitleAttribute,
    'no-non-adaptive-palette': noNonAdaptivePalette,
  },
};
