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
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export interface FocusOptions {
  className: string;
  mode: 'all' | 'deepest' | 'shallowest';
}

export const Focus = Extension.create<FocusOptions>({
  name: 'focus',

  addOptions() {
    return {
      className: 'has-focus',
      mode: 'all',
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('focus'),
        props: {
          decorations: ({ doc, selection }) => {
            const { isEditable, isFocused } = this.editor;
            const { anchor } = selection;
            const decorations: Decoration[] = [];

            if (!isEditable || !isFocused) {
              return DecorationSet.create(doc, []);
            }

            // Maximum Levels
            let maxLevels = 0;

            if (this.options.mode === 'deepest') {
              doc.descendants((node, pos) => {
                if (node.isText) {
                  return;
                }

                const isCurrent =
                  anchor >= pos && anchor <= pos + node.nodeSize - 1;

                if (!isCurrent) {
                  return false;
                }

                maxLevels += 1;

                return;
              });
            }

            // Loop through current
            let currentLevel = 0;

            doc.descendants((node, pos) => {
              if (node.isText) {
                return false;
              }

              const isCurrent =
                anchor >= pos && anchor <= pos + node.nodeSize - 1;

              if (!isCurrent) {
                return false;
              }

              currentLevel += 1;

              const outOfScope =
                (this.options.mode === 'deepest' &&
                  maxLevels - currentLevel > 0) ||
                (this.options.mode === 'shallowest' && currentLevel > 1);

              if (outOfScope) {
                return this.options.mode === 'deepest';
              }

              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: this.options.className,
                })
              );

              return;
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});
