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
import { mergeAttributes, Node } from '@tiptap/core';
import { Fragment, Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';

export const HandlebarsBlock = Node.create({
  name: 'handlebarsBlock',

  group: 'block',

  content: 'text*',

  parseHTML() {
    return [
      { tag: 'div.om-handlebars-block' },
      {
        tag: 'p',
        getAttrs: (node) => {
          const text = (node as HTMLElement).textContent || '';

          return text.trim().startsWith('{{') && text.trim().endsWith('}}')
            ? {}
            : false;
        },
        priority: 100,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: 'om-handlebars-block',
      }),
      0,
    ];
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state } = editor;
        const { selection } = state;
        const { $from } = selection;

        if ($from.parent.type.name === this.name) {
          return editor
            .chain()
            .insertContentAt($from.after(), { type: 'paragraph' })
            .focus($from.after() + 1)
            .run();
        }

        return false;
      },
    };
  },

  addProseMirrorPlugins() {
    const handlebarsBlockType = this.type;

    return [
      new Plugin({
        key: new PluginKey('handlebarsBlockNormalizer'),
        appendTransaction: (transactions, _, newState) => {
          const docChanged = transactions.some((tr) => tr.docChanged);
          if (!docChanged) {
            return null;
          }

          const { tr } = newState;
          const { doc, schema } = newState;
          let modified = false;

          doc.descendants((node, pos) => {
            if (node.type.name !== 'paragraph') {
              return true;
            }

            const text = node.textContent;
            const handlebarsRegex = /({{[^}]+}})/g;
            const parts: Array<{ text: string; isHandlebars: boolean }> = [];
            let lastIndex = 0;
            let match;

            while ((match = handlebarsRegex.exec(text)) !== null) {
              if (match.index > lastIndex) {
                parts.push({
                  text: text.substring(lastIndex, match.index),
                  isHandlebars: false,
                });
              }

              const handlebarsText = match[0].trim();
              if (
                handlebarsText.startsWith('{{') &&
                handlebarsText.endsWith('}}')
              ) {
                parts.push({ text: handlebarsText, isHandlebars: true });
              } else {
                parts.push({ text: match[0], isHandlebars: false });
              }

              lastIndex = match.index + match[0].length;
            }

            if (lastIndex < text.length) {
              parts.push({
                text: text.substring(lastIndex),
                isHandlebars: false,
              });
            }

            const hasHandlebars = parts.some((part) => part.isHandlebars);

            if (hasHandlebars && parts.length > 1) {
              const nodes: ProseMirrorNode[] = [];

              parts.forEach((part) => {
                const trimmedText = part.text.trim();
                if (!trimmedText) {
                  return;
                }

                if (part.isHandlebars) {
                  nodes.push(
                    handlebarsBlockType.create(null, schema.text(trimmedText))
                  );
                } else {
                  nodes.push(
                    schema.nodes.paragraph.create(
                      null,
                      schema.text(trimmedText)
                    )
                  );
                }
              });

              if (nodes.length > 0) {
                const mapping = new Mapping();
                const nodeSize = node.nodeSize;

                tr.replaceWith(
                  pos + mapping.map(0),
                  pos + mapping.map(nodeSize),
                  Fragment.from(nodes)
                );
                modified = true;
              }
            } else if (
              hasHandlebars &&
              parts.length === 1 &&
              parts[0].isHandlebars
            ) {
              const handlebarsNode = handlebarsBlockType.create(
                null,
                schema.text(parts[0].text)
              );
              tr.replaceWith(pos, pos + node.nodeSize, handlebarsNode);
              modified = true;
            }

            return true;
          });

          return modified ? tr : null;
        },
      }),
    ];
  },
});
