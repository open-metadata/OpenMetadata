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
import { InputRule, mergeAttributes, Node, nodePasteRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MathEquationComponent } from './MathEquationComponent';

export default Node.create({
  name: 'MathEquation',
  group: 'block',

  atom: true,

  addAttributes() {
    return {
      math_equation: {
        default: '',
      },
      isEditing: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'block-math-equation',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['block-math-equation', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathEquationComponent);
  },

  addInputRules() {
    return [
      new InputRule({
        find: new RegExp(`\\$\\$((?:\\.|[^\\$]|\\$)+?)\\$\\$`, 'g'),
        handler: (props) => {
          const latex = props.match[0];

          props
            .chain()
            .focus()
            .deleteRange(props.range)
            .insertContent({
              type: 'MathEquation',
              attrs: {
                math_equation: latex,
              },
            })
            .run();
        },
      }),
    ];
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: new RegExp(`\\$((?:\\.|[^\\$]|\\$)+?)\\$$`, 'g'),
        type: this.type,
        getAttributes: (match) => {
          return {
            math_equation: match[0],
          };
        },
      }),
      nodePasteRule({
        find: new RegExp(`\\$\\$((?:\\.|[^\\$]|\\$)+?)\\$\\$`, 'g'),
        type: this.type,
        getAttributes: (match) => {
          return {
            math_equation: match[0],
          };
        },
      }),
    ];
  },
});
