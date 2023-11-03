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
import { Fragment, Slice } from 'prosemirror-model';
import { TextSelection } from 'prosemirror-state';

import {
  findParentNode,
  isTextSelection,
  mergeAttributes,
  Node,
  wrappingInputRule,
} from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import CalloutComponent from './CalloutComponent';

export interface CalloutOptions {
  /**
   * Custom HTML attributes that should be added to the rendered HTML tag.
   */
  HTMLAttributes: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
  };
}

export interface CalloutAttributes {
  /**
   * The calloutType of the callout.
   */
  calloutType?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /**
       * Toggle a callout node.
       *
       * @param attributes
       * @returns
       */
      toggleCallout: (attributes: CalloutAttributes) => ReturnType;
    };
  }
}

export const Callout = Node.create<CalloutOptions>({
  name: 'callout',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  content: 'block+',

  group: 'block',

  defining: true,

  draggable: true,

  addAttributes() {
    return {
      calloutType: {
        default: 'note',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: `div[data-type="${this.name}"]`,
        getAttrs: (node) => {
          const htmlNode = node as HTMLElement;

          return {
            calloutType: htmlNode.getAttribute('data-calloutType') ?? '',
            content: htmlNode.textContent,
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': this.name,
        'data-calloutType': node.attrs.calloutType,
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutComponent);
  },

  addCommands() {
    return {
      toggleCallout: (attributes) => (editor) => {
        return editor.commands.toggleWrap(this.name, attributes);
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      Enter: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;

        if (!(isTextSelection(selection) && selection.empty)) {
          return false;
        }

        const { nodeBefore, parent } = selection.$from;

        if (!nodeBefore?.isText || !parent.type.isTextblock) {
          return false;
        }

        const regex = /^:::([A-Za-z]*)?$/;
        const { text, nodeSize } = nodeBefore;
        const { textContent } = parent;

        if (!text) {
          return false;
        }

        const matchesNodeBefore = text.match(regex);
        const matchesParent = textContent.match(regex);

        if (!matchesNodeBefore || !matchesParent) {
          return false;
        }

        const pos = selection.$from.before();
        const end = pos + nodeSize + 1;
        // +1 to account for the extra pos a node takes up

        const { tr } = state;
        const slice = new Slice(Fragment.from(this.type.create()), 0, 1);
        tr.replace(pos, end, slice);

        // Set the selection to within the callout
        tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)));
        view.dispatch(tr);

        return true;
      },

      /**
       * Handle the backspace key when deleting content.
       * Aims to stop merging callouts when deleting content in between.
       */
      Backspace: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;

        // If the selection is not empty, return false
        // and let other extension handle the deletion.
        if (!selection.empty) {
          return false;
        }

        const { $from } = selection;

        // If not at the start of current node, no joining will happen
        if ($from.parentOffset !== 0) {
          return false;
        }

        const previousPosition = $from.before($from.depth) - 1;

        // If nothing above to join with
        if (previousPosition < 1) {
          return false;
        }

        const previousPos = state.doc.resolve(previousPosition);

        // If resolving previous position fails, bail out
        if (!previousPos?.parent) {
          return false;
        }

        const previousNode = previousPos.parent;
        const parentNode = findParentNode(() => true)(selection);

        if (!parentNode) {
          return false;
        }

        const { node, pos, depth } = parentNode;

        // If current node is nested
        if (depth !== 1) {
          return false;
        }

        // If previous node is a callout, cut current node's content into it
        if (node.type !== this.type && previousNode.type === this.type) {
          const { content, nodeSize } = node;
          const { tr } = state;

          tr.delete(pos, pos + nodeSize);
          tr.setSelection(
            TextSelection.near(tr.doc.resolve(previousPosition - 1))
          );
          tr.insert(previousPosition - 1, content);

          view.dispatch(tr);

          return true;
        }

        return false;
      },
    };
  },

  addInputRules() {
    return [
      wrappingInputRule({
        find: /^::: $/,
        type: this.type,
      }),
    ];
  },
});
