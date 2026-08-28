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
 * Disallow raw HTML title="" attributes on JSX elements.
 * Use <Tooltip> from @openmetadata/ui-core-components instead.
 */
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
        // Only flag title attributes on native HTML elements (not components)
        const parent = node.parent;
        if (
          parent &&
          parent.type === 'JSXOpeningElement' &&
          node.name.name === 'title'
        ) {
          const elementName = parent.name.name;

          // Only flag lowercase (native HTML) elements
          // Skip uppercase (React components) and special cases like <title> HTML head element
          if (/^[a-z]/.test(elementName) && elementName !== 'title') {
            // Skip if it's a component class name like ant-select-selection-item
            // (these are legacy Ant Design patterns that will be migrated separately)
            const isLegacyAntd = parent.attributes?.some(
              (attr) =>
                attr.name?.name === 'className' &&
                attr.value?.value?.includes('ant-select-selection-item')
            );

            if (!isLegacyAntd) {
              context.report({ messageId: 'noRawTitle', node });
            }
          }
        }
      },
    };
  },
};

export default {
  rules: {
    'no-raw-title-attribute': noRawTitleAttribute,
  },
};
