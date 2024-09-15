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
import { NodeSelection, Plugin } from '@tiptap/pm/state';
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { EditorView, __serializeForClipboard } from '@tiptap/pm/view';
import { isUndefined } from 'lodash';
import i18n from '../../../../utils/i18next/LocalUtil';
import { BlockAndDragHandleOptions } from './BlockAndDragDrop';
import { absoluteRect, nodeDOMAtCoords, nodePosAtDOM } from './helpers';

export const BlockAndDragHandle = (options: BlockAndDragHandleOptions) => {
  let dragHandleElement: HTMLElement | null = null;
  let blockHandleElement: HTMLElement | null = null;

  // Drag Handle handlers

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
    if (isUndefined(nodePos)) {
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

  const handleDragClick = (event: MouseEvent, view: EditorView) => {
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
    if (isUndefined(nodePos)) {
      return;
    }

    view.dispatch(
      view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos))
    );
  };

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

  const handleMouseMoveForDragHandle = (event: MouseEvent) => {
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

    if (i18n.dir() === 'rtl') {
      dragHandleElement.style.right = `${rect.right - rect.width}px`;
    } else {
      dragHandleElement.style.left = `${rect.left - rect.width}px`;
    }
    dragHandleElement.style.top = `${rect.top}px`;
    showDragHandle();
  };

  // Block Handle handlers

  const hideBlockHandle = () => {
    if (blockHandleElement) {
      blockHandleElement.classList.add('hidden');
    }
  };

  const showBlockHandle = () => {
    if (blockHandleElement) {
      blockHandleElement.classList.remove('hidden');
    }
  };

  const handleMouseMoveForBlockHandle = (event: MouseEvent) => {
    const node = nodeDOMAtCoords({
      x: event.clientX + options.dragHandleWidth * 4 + options.blockHandleWidth,
      y: event.clientY,
    });

    if (!(node instanceof Element) || node.matches('ul, ol')) {
      hideBlockHandle();

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
      rect.left -= options.blockHandleWidth;
    }
    rect.width = options.blockHandleWidth;

    if (!blockHandleElement) {
      return;
    }

    if (i18n.dir() === 'rtl') {
      blockHandleElement.style.right = `${
        rect.right - rect.width - options.blockHandleWidth
      }px`;
    } else {
      blockHandleElement.style.left = `${
        rect.left - rect.width - options.blockHandleWidth
      }px`;
    }
    blockHandleElement.style.top = `${rect.top}px`;
    showBlockHandle();
  };

  return new Plugin({
    view: (view) => {
      // drag handle initialization
      dragHandleElement = document.createElement('div');
      dragHandleElement.draggable = true;
      dragHandleElement.dataset.dragHandle = '';
      dragHandleElement.title = 'Drag to move\nClick to open menu';
      dragHandleElement.classList.add('om-drag-handle');
      dragHandleElement.addEventListener('dragstart', (e) => {
        handleDragStart(e, view);
      });
      dragHandleElement.addEventListener('click', (e) => {
        handleDragClick(e, view);
      });

      hideDragHandle();

      // block handle initialization
      blockHandleElement = document.createElement('div');
      blockHandleElement.draggable = false;
      blockHandleElement.dataset.blockHandle = '';
      blockHandleElement.title = 'Add new node';
      blockHandleElement.classList.add('om-block-handle');

      hideBlockHandle();

      view?.dom?.parentElement?.appendChild(dragHandleElement);
      view?.dom?.parentElement?.appendChild(blockHandleElement);

      return {
        destroy: () => {
          dragHandleElement?.remove?.();
          dragHandleElement = null;

          blockHandleElement?.remove?.();
          blockHandleElement = null;
        },
      };
    },
    props: {
      handleDOMEvents: {
        mousemove: (view, event) => {
          if (!view.editable) {
            return;
          }
          handleMouseMoveForDragHandle(event);
          handleMouseMoveForBlockHandle(event);
        },
        keydown: () => {
          hideDragHandle();
          hideBlockHandle();
        },
        mousewheel: () => {
          hideDragHandle();
          hideBlockHandle();
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
