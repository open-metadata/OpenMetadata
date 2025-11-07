/*
 *  Copyright 2023 Collate.
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
 * Converts editor HTML to backend-compatible format by unwrapping handlebars blocks
 * @param html - The HTML output from editor.getHTML()
 * @returns HTML with handlebars blocks converted to plain text
 *
 * @example
 * Input:
 * <div class="om-handlebars-block">{{#if true }}</div>
 * <p>content</p>
 * <div class="om-handlebars-block">{{/if}}</div>
 *
 * Output:
 * {{#if true }}
 * <p>content</p>
 * {{/if}}
 */
export const serializeHandlebarsForBackend = (html: string): string => {
  let result = html.replace(
    /<div[^>]*class="[^"]*om-handlebars-block[^"]*"[^>]*>(.*?)<\/div>/gi,
    '$1'
  );

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = result;

  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;

      if (element.tagName === 'P') {
        const text = element.textContent || '';
        const handlebarsRegex = /^({{[^}]+}})$/;

        if (handlebarsRegex.test(text.trim())) {
          const textNode = document.createTextNode(text.trim());
          element.parentNode?.replaceChild(textNode, element);

          return;
        }
      }

      Array.from(node.childNodes).forEach(processNode);
    }
  };

  processNode(tempDiv);
  result = tempDiv.innerHTML;

  result = result.replace(/<br\s*\/?>/gi, '\n');

  return result;
};

/**
 * Parses backend HTML to editor-compatible format by wrapping handlebars syntax
 * @param html - The HTML from backend
 * @returns HTML with handlebars syntax wrapped in handlebarsBlock divs
 *
 * @example
 * Input:
 * {{#if true }}
 * <p>content</p>
 * {{/if}}
 *
 * Output:
 * <div class="om-handlebars-block">{{#if true }}</div>
 * <p>content</p>
 * <div class="om-handlebars-block">{{/if}}</div>
 */
export const parseHandlebarsFromBackend = (html: string): string => {
  if (!html || html.includes('om-handlebars-block')) {
    return html;
  }

  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  const processNode = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      const handlebarsRegex = /({{[^}]+}})/g;
      const matches = text.match(handlebarsRegex);

      if (matches) {
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;

        text.replace(handlebarsRegex, (match, _, offset) => {
          if (offset > lastIndex) {
            fragment.appendChild(
              document.createTextNode(text.substring(lastIndex, offset))
            );
          }

          const trimmedMatch = match.trim();
          if (trimmedMatch.startsWith('{{') && trimmedMatch.endsWith('}}')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'om-handlebars-block';
            wrapper.textContent = trimmedMatch;
            fragment.appendChild(wrapper);
          } else {
            fragment.appendChild(document.createTextNode(match));
          }

          lastIndex = offset + match.length;

          return match;
        });

        if (lastIndex < text.length) {
          fragment.appendChild(
            document.createTextNode(text.substring(lastIndex))
          );
        }

        node.parentNode?.replaceChild(fragment, node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.tagName === 'BR') {
        return;
      }

      Array.from(node.childNodes).forEach(processNode);
    }
  };

  processNode(tempDiv);

  return tempDiv.innerHTML;
};
