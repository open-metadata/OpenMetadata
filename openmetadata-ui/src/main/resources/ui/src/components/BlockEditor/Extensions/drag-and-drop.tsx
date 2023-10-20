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

import { NodeSelection, Plugin } from '@tiptap/pm/state';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { EditorView, __serializeForClipboard } from '@tiptap/pm/view';

export interface DragHandleOptions {
  /**
   * The width of the drag handle
   */
  dragHandleWidth: number;
}
const absoluteRect = (node: Element) => {
  const data = node.getBoundingClientRect();

  return {
    top: data.top,
    left: data.left,
    width: data.width,
  };
};

const nodeDOMAtCoords = (coords: { x: number; y: number }) => {
  return document
    .elementsFromPoint(coords.x, coords.y)
    .find(
      (elem: Element) =>
        elem.parentElement?.matches?.('.ProseMirror') ||
        elem.matches(
          [
            'li',
            'p:not(:first-child)',
            'pre',
            'blockquote',
            'h1, h2, h3, h4, h5, h6',
          ].join(', ')
        )
    );
};

const nodePosAtDOM = (node: Element, view: EditorView) => {
  const boundingRect = node.getBoundingClientRect();

  return view.posAtCoords({
    left: boundingRect.left + 1,
    top: boundingRect.top + 1,
  })?.inside;
};

const DragHandle = (options: DragHandleOptions) => {
  const handleDragStart = (event: DragEvent, view: EditorView) => {
    view.focus();

    if (!event.dataTransfer) {
      return;
    }

    const node = nodeDOMAtCoords({
      x: event.clientX + 50 + options.dragHandleWidth,
      y: event.clientY,
    });

    if (!(node instanceof Element)) {
      return;
    }

    const nodePos = nodePosAtDOM(node, view);
    if (nodePos == null || nodePos < 0) {
      return;
    }

    view.dispatch(
      view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos))
    );

    const slice = view.state.selection.content();
    const { dom, text } = __serializeForClipboard(view, slice);

    event.dataTransfer.clearData();
    event.dataTransfer.setData('text/html', dom.innerHTML);
    event.dataTransfer.setData('text/plain', text);
    event.dataTransfer.effectAllowed = 'copyMove';

    event.dataTransfer.setDragImage(node, 0, 0);

    view.dragging = { slice, move: event.ctrlKey };
  };

  const handleClick = (event: MouseEvent, view: EditorView) => {
    view.focus();

    view.dom.classList.remove('om-node-dragging');

    const node = nodeDOMAtCoords({
      x: event.clientX + 50 + options.dragHandleWidth,
      y: event.clientY,
    });

    if (!(node instanceof Element)) {
      return;
    }

    const nodePos = nodePosAtDOM(node, view);
    if (!nodePos) {
      return;
    }

    view.dispatch(
      view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos))
    );
  };

  let dragHandleElement: HTMLElement | null = null;

  const hideDragHandle = () => {
    if (dragHandleElement) {
      dragHandleElement.classList.add('hidden');
    }
  };

  const showDragHandle = () => {
    if (dragHandleElement) {
      dragHandleElement.classList.remove('hidden');
    }
  };

  return new Plugin({
    view: (view) => {
      dragHandleElement = document.createElement('div');
      dragHandleElement.draggable = true;
      dragHandleElement.dataset.dragHandle = '';
      dragHandleElement.classList.add('om-drag-handle');
      dragHandleElement.addEventListener('dragstart', (e) => {
        handleDragStart(e, view);
      });
      dragHandleElement.addEventListener('click', (e) => {
        handleClick(e, view);
      });

      hideDragHandle();

      view?.dom?.parentElement?.appendChild(dragHandleElement);

      return {
        destroy: () => {
          dragHandleElement?.remove?.();
          dragHandleElement = null;
        },
      };
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!view.editable) {
            return;
          }

          const node = nodeDOMAtCoords({
            x: event.clientX + 50 + options.dragHandleWidth,
            y: event.clientY,
          });

          if (!(node instanceof Element) || node.matches('ul, ol')) {
            hideDragHandle();

            return;
          }

          const compStyle = window.getComputedStyle(node);
          const lineHeight = parseInt(compStyle.lineHeight, 10);
          const paddingTop = parseInt(compStyle.paddingTop, 10);

          const rect = absoluteRect(node);

          rect.top += (lineHeight - 24) / 2;
          rect.top += paddingTop;
          // Li markers
          if (node.matches('ul:not([data-type=taskList]) li, ol li')) {
            rect.left -= options.dragHandleWidth;
          }
          rect.width = options.dragHandleWidth;

          if (!dragHandleElement) {
            return;
          }

          dragHandleElement.style.left = `${rect.left - rect.width}px`;
          dragHandleElement.style.top = `${rect.top}px`;
          showDragHandle();
        },
        keydown: () => {
          hideDragHandle();
        },
        mousewheel: () => {
          hideDragHandle();
        },
        // dragging class is used for CSS
        dragstart: (view) => {
          view.dom.classList.add('om-node-dragging');
        },
        drop: (view) => {
          view.dom.classList.remove('om-node-dragging');
        },
        dragend: (view) => {
          view.dom.classList.remove('om-node-dragging');
        },
      },
    },
  });
};

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface DragAndDropOptions {}

const DragAndDrop = Extension.create<DragAndDropOptions>({
  name: 'dragAndDrop',

  addProseMirrorPlugins() {
    return [
      DragHandle({
        dragHandleWidth: 24,
      }),
    ];
  },
});

export default DragAndDrop;
