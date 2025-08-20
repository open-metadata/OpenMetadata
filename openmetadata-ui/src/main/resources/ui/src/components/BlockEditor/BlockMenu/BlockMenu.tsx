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
import { useCallback, useEffect, useRef } from 'react';
import tippy, { Instance } from 'tippy.js';

import { Editor } from '@tiptap/react';

import { NodeSelection } from '@tiptap/pm/state';
import { isUndefined } from 'lodash';
import { useTranslation } from 'react-i18next';
import DeleteIcon from '../../../assets/svg/ic-delete.svg?react';
import DuplicateIcon from '../../../assets/svg/ic-duplicate.svg?react';
import {
  nodeDOMAtCoords,
  nodePosAtDOM,
} from '../Extensions/BlockAndDragDrop/helpers';
import './block-menu.less';

interface BlockMenuProps {
  editor: Editor;
}

export const BlockMenu = (props: BlockMenuProps) => {
  const { t } = useTranslation();
  const { editor } = props;
  const { view, isEditable } = editor;
  const menuRef = useRef<HTMLDivElement>(null);
  const popup = useRef<Instance | null>(null);

  const handleClickBlockHandle = useCallback(
    (event: MouseEvent) => {
      const { view: editorView } = editor;

      const node = nodeDOMAtCoords({
        x: event.clientX + 24 * 4 + 24,
        y: event.clientY,
      });

      if (!(node instanceof Element)) {
        return;
      }

      const nodePos = nodePosAtDOM(node, editorView);
      if (isUndefined(nodePos)) {
        return;
      }
      const nodeSelection = NodeSelection.create(editorView.state.doc, nodePos);

      editor
        .chain()
        .insertContentAt(
          nodeSelection.to,
          { type: 'paragraph' },
          {
            updateSelection: true,
          }
        )
        .focus(nodeSelection.to)
        .run();
    },
    [editor]
  );

  const handleClickDragHandle = useCallback(
    (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (target.matches('[data-block-handle]')) {
        handleClickBlockHandle(event);
      }

      if (!target.matches('[data-drag-handle]')) {
        popup.current?.hide();

        return;
      }

      event.preventDefault();
      event.stopPropagation();

      popup.current?.setProps({
        getReferenceClientRect: () => target.getBoundingClientRect(),
      });

      popup.current?.show();
    },
    [view]
  );

  const handleKeyDown = () => {
    popup.current?.hide();
  };

  const handleDuplicate = useCallback(() => {
    const { view } = editor;
    const { state } = view;
    const { selection } = state;

    editor
      .chain()
      .insertContentAt(
        selection.to,
        selection.content().content.firstChild?.toJSON(),
        {
          updateSelection: true,
        }
      )
      .focus(selection.to)
      .run();

    popup.current?.hide();
  }, [editor]);

  const handleDelete = useCallback(() => {
    editor.commands.deleteSelection();
    popup.current?.hide();
  }, [editor]);

  useEffect(() => {
    /**
     * Create a new tippy instance for the block menu if the editor is editable
     */
    if (menuRef.current && isEditable) {
      menuRef.current.remove();
      menuRef.current.style.visibility = 'visible';

      popup.current = tippy(view.dom, {
        getReferenceClientRect: null,
        content: menuRef.current,
        appendTo: 'parent',
        trigger: 'manual',
        interactive: true,
        arrow: false,
        placement: 'top',
        hideOnClick: true,
        onShown: () => {
          menuRef.current?.focus();
        },
      });
    }

    return () => {
      popup.current?.destroy();
      popup.current = null;
    };
  }, [isEditable]);

  useEffect(() => {
    document.addEventListener('click', handleClickDragHandle);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('click', handleClickDragHandle);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleClickDragHandle, handleKeyDown]);

  return (
    <div className="block-menu" data-testid="menu-container" ref={menuRef}>
      <button
        className="action"
        data-testid="delete-btn"
        onClick={handleDelete}>
        <div className="action-icon-container">
          <DeleteIcon width={16} />
        </div>
        <div className="action-name">{t('label.delete')}</div>
      </button>

      <button
        className="action"
        data-testid="duplicate-btn"
        onClick={handleDuplicate}>
        <div className="action-icon-container">
          <DuplicateIcon width={16} />
        </div>
        <div className="action-name">{t('label.duplicate')}</div>
      </button>
    </div>
  );
};

export default BlockMenu;
