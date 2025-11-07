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
import { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion, { SuggestionOptions } from '@tiptap/suggestion';

export type HandlebarsOptions = {
  HTMLAttributes: Record<string, unknown>;
  renderLabel: (props: {
    options: HandlebarsOptions;
    node: ProseMirrorNode;
  }) => string;
  suggestion: Omit<SuggestionOptions, 'editor'>;
};

export const HandlebarsPluginKey = new PluginKey('handlebars');

export { HandlebarsBlock } from './HandlebarsBlock';
export {
  parseHandlebarsFromBackend,
  serializeHandlebarsForBackend,
} from './handlebarsUtils';

export const Handlebars = Node.create<HandlebarsOptions>({
  name: 'handlebars',

  addOptions() {
    return {
      HTMLAttributes: {},
      renderLabel({ node }) {
        return `{{${node.attrs.label ?? node.attrs.id}}}`;
      },
      suggestion: {
        char: '{',
        pluginKey: HandlebarsPluginKey,
        command: ({ editor, range, props }) => {
          const nodeAfter = editor.view.state.selection.$to.nodeAfter;
          const overrideSpace = nodeAfter?.text?.startsWith(' ');

          if (overrideSpace) {
            range.to += 1;
          }

          // If helper has syntax template, insert it as structured content
          if (props.type === 'helper' && props.syntax) {
            const { syntax, cursorOffset } = props;
            const insertPos = range.from;

            // Parse syntax and create structured content
            const lines = syntax.split('\n');
            const content: Array<{
              type: string;
              content?: Array<{ type: string; text: string }>;
            }> = [];

            lines.forEach((line: string) => {
              if (line.trim().startsWith('{{')) {
                // Handlebars syntax line - use handlebarsBlock
                content.push({
                  type: 'handlebarsBlock',
                  content: [{ type: 'text', text: line }],
                });
              } else if (line.trim() === '') {
                // Empty line - use paragraph
                content.push({
                  type: 'paragraph',
                });
              } else {
                // Regular content - use paragraph
                content.push({
                  type: 'paragraph',
                  content: [{ type: 'text', text: line }],
                });
              }
            });

            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContentAt(insertPos, content)
              .run();

            // Set cursor position based on cursorOffset
            if (cursorOffset !== undefined) {
              const newPos = insertPos + cursorOffset;
              editor.commands.setTextSelection(newPos);
            }
          } else {
            // For variables, insert as node (original behavior)
            editor
              .chain()
              .focus()
              .insertContentAt(range, [
                {
                  type: this.name,
                  attrs: props,
                },
                {
                  type: 'text',
                  text: ' ',
                },
              ])
              .run();

            window.getSelection()?.collapseToEnd();
          }
        },
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const type = state.schema.nodes[this.name];
          const allow = !!$from.parent.type.contentMatch.matchType(type);

          return allow;
        },
      },
    };
  },

  group: 'inline',

  inline: true,

  selectable: false,

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-id'),
        renderHTML: (attributes) => {
          if (!attributes.id) {
            return {};
          }

          return {
            'data-id': attributes.id,
          };
        },
      },

      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => {
          if (!attributes.label) {
            return {};
          }

          return {
            'data-label': attributes.label,
          };
        },
      },
      type: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-type'),
        renderHTML: (attributes) => {
          if (!attributes.type) {
            return {};
          }

          return {
            'data-type': attributes.type,
          };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-handlebars]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'span',
      mergeAttributes(
        {
          'data-handlebars': 'true',
          class: 'om-handlebars',
        },
        this.options.HTMLAttributes,
        HTMLAttributes
      ),
      this.options.renderLabel({
        options: this.options,
        node,
      }),
    ];
  },

  renderText({ node }) {
    return this.options.renderLabel({
      options: this.options,
      node,
    });
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isHandlebars = false;
          const { selection } = state;
          const { empty, anchor } = selection;

          if (!empty) {
            return false;
          }

          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name !== this.name) {
              return;
            }

            isHandlebars = true;
            tr.insertText(
              this.options.suggestion.char || '',
              pos,
              pos + node.nodeSize
            );

            return false;
          });

          return isHandlebars;
        }),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
