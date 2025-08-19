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
import { Editor } from '@tiptap/react';
import { Button, Space } from 'antd';
import { useCallback, useEffect, useRef } from 'react';
import tippy, { Instance } from 'tippy.js';
import { ReactComponent as IconDeleteTable } from '../../../assets/svg/ic-delete.svg';
import { ReactComponent as IconAddColumnAfter } from '../../../assets/svg/ic-format-add-column-after.svg';
import { ReactComponent as IconAddRowAfter } from '../../../assets/svg/ic-format-add-row-after.svg';
import { ReactComponent as IconDeleteColumn } from '../../../assets/svg/ic-format-delete-column.svg';
import { ReactComponent as IconDeleteRow } from '../../../assets/svg/ic-format-delete-row.svg';
import { Tooltip } from '../../common/AntdCompat';
;

interface TableMenuProps {
  editor: Editor;
}

const TableMenu = (props: TableMenuProps) => {
  const { editor } = props;
  const { view, isEditable } = editor;
  const menuRef = useRef<HTMLDivElement>(null);
  const tableMenuPopup = useRef<Instance | null>(null);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    const table = target?.closest('.tableWrapper');

    if (table?.contains(target)) {
      tableMenuPopup.current?.setProps({
        getReferenceClientRect: () => table.getBoundingClientRect(),
      });

      tableMenuPopup.current?.show();
    }
  }, []);

  useEffect(() => {
    if (menuRef.current && isEditable) {
      menuRef.current.remove();
      menuRef.current.style.visibility = 'visible';

      tableMenuPopup.current = tippy(view.dom, {
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
      tableMenuPopup.current?.destroy();
      tableMenuPopup.current = null;
    };
  }, [isEditable]);

  useEffect(() => {
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [handleMouseDown]);

  return (
    <div className="table-menu" ref={menuRef}>
      <Space size="middle">
        <Tooltip showArrow={false} title="Add row after current row">
          <Button
            data-testid="Add row after current row"
            type="text"
            onClick={() => editor.chain().focus().addRowAfter().run()}>
            <IconAddRowAfter style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Add column after current column">
          <Button
            data-testid="Add column after current column"
            type="text"
            onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <IconAddColumnAfter style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Delete current row">
          <Button
            data-testid="Delete current row"
            type="text"
            onClick={() => editor.chain().focus().deleteRow().run()}>
            <IconDeleteRow style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Delete current column">
          <Button
            data-testid="Delete current col"
            type="text"
            onClick={() => editor.chain().focus().deleteColumn().run()}>
            <IconDeleteColumn style={{ verticalAlign: 'middle' }} />
          </Button>
        </Tooltip>

        <Tooltip showArrow={false} title="Delete table">
          <Button
            data-testid="Delete table"
            type="text"
            onClick={() => {
              editor.chain().focus().deleteTable().run();
              tableMenuPopup.current?.hide();
            }}>
            <IconDeleteTable style={{ verticalAlign: 'middle' }} width={14} />
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
};

export default TableMenu;
