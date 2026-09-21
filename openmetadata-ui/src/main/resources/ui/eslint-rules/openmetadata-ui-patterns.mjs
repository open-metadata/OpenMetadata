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

export default {
  rules: {
    'no-raw-title-attribute': noRawTitleAttribute,
  },
};
