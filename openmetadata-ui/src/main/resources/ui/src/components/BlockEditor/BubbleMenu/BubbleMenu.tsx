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
import { Editor, isNodeSelection } from '@tiptap/core';
import {
  BubbleMenu as CoreBubbleMenu,
  BubbleMenuProps as CoreBubbleMenuProps,
} from '@tiptap/react';
import { Button, Typography } from 'antd';
import { Tooltip } from '../../common/AntdCompat';;
import classNames from 'classnames';
import { isString } from 'lodash';
import { FC, useMemo } from 'react';
import { ReactComponent as FormatBoldIcon } from '../../../assets/svg/ic-format-bold.svg';
import { ReactComponent as FormatInlineCodeIcon } from '../../../assets/svg/ic-format-inline-code.svg';
import { ReactComponent as FormatItalicIcon } from '../../../assets/svg/ic-format-italic.svg';
import { ReactComponent as FormatLinkIcon } from '../../../assets/svg/ic-format-link.svg';
import { ReactComponent as FormatStrikeIcon } from '../../../assets/svg/ic-format-strike.svg';

interface BubbleMenuProps {
  editor: Editor;
  toggleLink: () => void;
}

export interface BubbleMenuItem {
  ariaLabel: string;
  icon: SvgComponent | string;
  className?: string;
  command: () => void;
  isActive: () => boolean;
}

const BubbleMenu: FC<BubbleMenuProps> = ({ editor, toggleLink }) => {
  const { menuList } = useMemo(() => {
    const menuList: BubbleMenuItem[] = [
      {
        ariaLabel: 'Heading 1',
        className: 'm-x-xs',
        command: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        isActive: () => editor.isActive('heading', { level: 1 }),
        icon: 'H1',
      },
      {
        ariaLabel: 'Heading 2',
        className: 'm-r-xs',
        command: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        isActive: () => editor.isActive('heading', { level: 2 }),
        icon: 'H2',
      },
      {
        ariaLabel: 'Heading 3',
        command: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        isActive: () => editor.isActive('heading', { level: 3 }),
        icon: 'H3',
      },
      {
        ariaLabel: 'Bold',
        command: () => editor.chain().focus().toggleBold().run(),
        isActive: () => editor.isActive('bold'),
        icon: FormatBoldIcon,
      },
      {
        ariaLabel: 'Italic',
        command: () => editor.chain().focus().toggleItalic().run(),
        isActive: () => editor.isActive('italic'),
        icon: FormatItalicIcon,
      },
      {
        ariaLabel: 'Strike',
        command: () => editor.chain().focus().toggleStrike().run(),
        isActive: () => editor.isActive('strike'),
        icon: FormatStrikeIcon,
      },
      {
        ariaLabel: 'Inline code',
        command: () => editor.chain().focus().toggleCode().run(),
        isActive: () => editor.isActive('code'),
        icon: FormatInlineCodeIcon,
      },
      {
        ariaLabel: 'Link',
        command: () => {
          editor.chain().focus().setLink({ href: '' }).run();
          toggleLink();
        },
        isActive: () => editor.isActive('link'),
        icon: FormatLinkIcon,
      },
    ];

    return { menuList };
  }, [editor]);

  const handleShouldShow: CoreBubbleMenuProps['shouldShow'] = ({
    state,
    editor,
  }) => {
    const { selection } = state;
    const { empty } = selection;

    // don't show bubble menu if:
    // - the selected node is an image
    // - the selection is empty
    // - the selection is a node selection (for drag handles)
    // - link is active
    // - editor is not editable
    if (
      editor.isActive('image') ||
      empty ||
      isNodeSelection(selection) ||
      editor.isActive('link') ||
      editor.isActive('table') ||
      !editor.isEditable
    ) {
      return false;
    }

    return true;
  };

  return (
    <CoreBubbleMenu
      className="menu-wrapper"
      data-testid="menu-container"
      editor={editor}
      shouldShow={handleShouldShow}>
      {menuList.map(
        ({ icon: Icon, ariaLabel, className, command, isActive }) => (
          <Tooltip key={ariaLabel} title={ariaLabel}>
            <Button
              aria-label={ariaLabel}
              className={classNames('p-0', className, {
                'is-format-active': isActive(),
              })}
              type="text"
              onClick={command}>
              {isString(Icon) ? (
                <Typography>{Icon}</Typography>
              ) : (
                <Icon className="d-flex " height={24} width={24} />
              )}
            </Button>
          </Tooltip>
        )
      )}
    </CoreBubbleMenu>
  );
};

export default BubbleMenu;
