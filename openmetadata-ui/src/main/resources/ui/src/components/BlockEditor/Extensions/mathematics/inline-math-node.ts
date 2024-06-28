/*
 *  Copyright 2024 Collate.
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
import {
  Content,
  InputRule,
  mergeAttributes,
  Node,
  PasteRule,
} from '@tiptap/core';
import katex from 'katex';
import { MATHEMATICS_EXTENSION_DEFAULT_OPTIONS } from '../../../../constants/BlockEditor.constants';
import { generateUUID } from '../../../../utils/StringsUtils';
import { updateEvaluation } from './helpers/update-evaluation';
import {
  AllVariableUpdateListeners,
  MathExtensionOption,
  MathVariables,
  VariableUpdateListeners,
} from './mathematics.interface';

export const InlineMathNode = Node.create<MathExtensionOption>({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  selectable: true,
  atom: true,

  addOptions() {
    return MATHEMATICS_EXTENSION_DEFAULT_OPTIONS;
  },

  addAttributes() {
    return {
      latex: {
        default: 'x_1',
        parseHTML: (element) => element.getAttribute('data-latex'),
        renderHTML: (attributes) => {
          return {
            'data-latex': attributes.latex,
          };
        },
      },
      evaluate: {
        default: 'no',
        parseHTML: (element) => element.getAttribute('data-evaluate'),
        renderHTML: (attributes) => {
          return {
            'data-evaluate': attributes.evaluate,
          };
        },
      },
      display: {
        default: 'no',
        parseHTML: (element) => element.getAttribute('data-display'),
        renderHTML: (attributes) => {
          return {
            'data-display': attributes.display,
          };
        },
      },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        find: new RegExp(`\\$([^\\s])([^$]*)\\$$`, ''),
        handler: (props) => {
          if (props.match[1].startsWith('$')) {
            return;
          }
          let latex = props.match[1] + props.match[2];
          latex = latex.trim();
          const showRes = latex.endsWith('=');
          if (showRes) {
            latex = latex.substring(0, latex.length - 1);
          }
          const content: Content = [
            {
              type: 'inlineMath',
              attrs: {
                latex: latex,
                evaluate: showRes ? 'yes' : 'no',
                display: 'no',
              },
            },
          ];
          props
            .chain()
            .insertContentAt(
              {
                from: props.range.from,
                to: props.range.to,
              },
              content,
              { updateSelection: true }
            )
            .run();
        },
      }),
      new InputRule({
        find: new RegExp(`\\$\\$([^\\s])([^$]*)\\$\\$$`, ''),
        handler: (props) => {
          let latex = props.match[1] + props.match[2];
          const showRes = latex.endsWith('=');
          if (showRes) {
            latex = latex.substring(0, latex.length - 1);
          }
          const content: Content = [
            {
              type: 'inlineMath',
              attrs: {
                latex: latex,
                evaluate: showRes ? 'yes' : 'no',
                display: 'yes',
              },
            },
          ];
          props
            .chain()
            .insertContentAt(
              {
                from: props.range.from,
                to: props.range.to,
              },
              content,
              { updateSelection: true }
            )
            .run();
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      new PasteRule({
        find: new RegExp(`\\$([^\\s])([^$]*)\\$$`, 'g'),
        handler: (props) => {
          const latex = props.match[1] + props.match[2];
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              [
                {
                  type: 'inlineMath',
                  attrs: { latex: latex, evaluate: 'no', display: 'no' },
                },
              ],
              { updateSelection: true }
            )
            .run();
        },
      }),
      new PasteRule({
        find: new RegExp(`\\$\\$([^\\s])([^$]*)\\$\\$$`, 'g'),
        handler: (props) => {
          const latex = props.match[1] + props.match[2];
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              [
                {
                  type: 'inlineMath',
                  attrs: { latex: latex, evaluate: 'no', display: 'yes' },
                },
              ],
              { updateSelection: true }
            )
            .run();
        },
      }),
      new PasteRule({
        find: /\\\(((.|[\r\n])*?)\\\)/g,

        handler: (props) => {
          props
            .chain()
            .insertContentAt(
              { from: props.range.from, to: props.range.to },
              [
                {
                  type: 'inlineMath',
                  attrs: { latex: props.match[1] },
                },
              ],
              { updateSelection: true }
            )
            .run();
        },
      }),
    ];
  },

  parseHTML() {
    return [
      {
        tag: `span[data-type="${this.name}"]`,
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    let latex = 'x';
    if (node.attrs.latex && typeof node.attrs.latex == 'string') {
      latex = node.attrs.latex;
    }

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-type': this.name,
      }),
      '$' + latex + '$',
    ];
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () =>
        this.editor.commands.command(({ tr, state }) => {
          let isMention = false;
          const { selection } = state;
          const { empty, anchor } = selection;
          if (!empty) {
            return false;
          }
          state.doc.nodesBetween(anchor - 1, anchor, (node, pos) => {
            if (node.type.name === this.name) {
              isMention = true;
              const displayMode = node.attrs.display === 'yes';
              const [firstDelimiter, secondDelimiter] = displayMode
                ? ['$$', '$']
                : ['$', ''];
              tr.insertText(
                firstDelimiter + (node.attrs.latex || '') + secondDelimiter,
                pos,
                anchor
              );
            }
          });

          return isMention;
        }),
    };
  },

  addNodeView() {
    return ({ HTMLAttributes, node, getPos, editor }) => {
      const outerSpan = document.createElement('span');
      const span = document.createElement('span');
      outerSpan.appendChild(span);
      let latex = 'x_1';
      if (
        'data-latex' in HTMLAttributes &&
        typeof HTMLAttributes['data-latex'] === 'string'
      ) {
        latex = HTMLAttributes['data-latex'];
      }
      const displayMode = node.attrs.display === 'yes';
      katex.render(latex, span, {
        displayMode: displayMode,
        throwOnError: false,
        ...(this.options.katexOptions ?? {}),
      });

      outerSpan.classList.add('tiptap-math', 'latex');

      const showEvalResult = node.attrs.evaluate === 'yes';
      const id = generateUUID();

      const shouldEvaluate = this.options.evaluation;
      // Should evaluate (i.e., also register new variables etc.)
      if (shouldEvaluate) {
        outerSpan.title = 'Click to toggle result';
        outerSpan.style.cursor = 'pointer';
        const resultSpan = document.createElement('span');
        outerSpan.append(resultSpan);
        resultSpan.classList.add('tiptap-math', 'result');
        resultSpan.classList.add('katex');
        const evalRes = updateEvaluation(
          latex,
          id,
          resultSpan,
          showEvalResult,
          this.editor.storage.inlineMath
        );
        // On click, update the evaluate attribute (effectively triggering whether the result is shown)
        outerSpan.addEventListener('click', (ev) => {
          if (editor.isEditable && typeof getPos === 'function') {
            editor
              .chain()
              .command(({ tr }) => {
                const position = getPos();
                tr.setNodeAttribute(
                  position,
                  'evaluate',
                  !showEvalResult ? 'yes' : 'no'
                );

                return true;
              })
              .run();
          }
          ev.preventDefault();
          ev.stopPropagation();
          ev.stopImmediatePropagation();
        });

        return {
          dom: outerSpan,
          destroy: () => {
            if (evalRes?.variablesUsed) {
              // De-register listeners
              for (const v of evalRes.variablesUsed) {
                let listenersForV: VariableUpdateListeners =
                  this.editor.storage.inlineMath.variableListeners[v];
                if (listenersForV === undefined) {
                  listenersForV = [];
                }
                this.editor.storage.inlineMath.variableListeners[v] =
                  listenersForV.filter((l) => l.id !== id);
              }
            }
          },
        };
      } else {
        // Should not evaluate math expression (just display them)
        return {
          dom: outerSpan,
        };
      }
    };
  },

  addStorage(): {
    variables: MathVariables;
    variableListeners: AllVariableUpdateListeners;
  } {
    return {
      variables: {},
      variableListeners: {},
    };
  },
});
