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
import { Editor } from '@tiptap/core';
import { BubbleMenu as CoreBubbleMenu } from '@tiptap/react';
import { Button, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isString } from 'lodash';
import React, { FC, useMemo } from 'react';
import { ReactComponent as FormatBoldIcon } from '../../../assets/svg/ic-format-bold.svg';
import { ReactComponent as FormatInlineCodeIcon } from '../../../assets/svg/ic-format-inline-code.svg';
import { ReactComponent as FormatItalicIcon } from '../../../assets/svg/ic-format-italic.svg';
import { ReactComponent as FormatLinkIcon } from '../../../assets/svg/ic-format-link.svg';
import { ReactComponent as FormatStrikeIcon } from '../../../assets/svg/ic-format-strike.svg';

interface BubbleMenuProps {
  editor: Editor;
  toggleLink: () => void;
}

const BubbleMenu: FC<BubbleMenuProps> = ({ editor, toggleLink }) => {
  const { menuList } = useMemo(() => {
    const menuList = [
      {
        ariaLabel: 'Heading 1',
        className: 'm-x-xs',
        disabled: !editor
          .can()
          .chain()
          .focus()
          .toggleHeading({ level: 1 })
          .run(),
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        icon: 'H1',
      },
      {
        ariaLabel: 'Heading 2',
        className: 'm-r-xs',
        disabled: !editor
          .can()
          .chain()
          .focus()
          .toggleHeading({ level: 2 })
          .run(),
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        icon: 'H2',
      },
      {
        ariaLabel: 'Heading 3',
        className: '',
        disabled: !editor
          .can()
          .chain()
          .focus()
          .toggleHeading({ level: 3 })
          .run(),
        onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        icon: 'H3',
      },
      {
        ariaLabel: 'Bold',
        className: editor.isActive('bold') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleBold().run(),
        onClick: () => editor.chain().focus().toggleBold().run(),
        icon: FormatBoldIcon,
      },
      {
        ariaLabel: 'Italic',
        className: editor.isActive('italic') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleItalic().run(),
        onClick: () => editor.chain().focus().toggleItalic().run(),
        icon: FormatItalicIcon,
      },
      {
        ariaLabel: 'Strike',
        className: editor.isActive('strike') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleStrike().run(),
        onClick: () => editor.chain().focus().toggleStrike().run(),
        icon: FormatStrikeIcon,
      },
      {
        ariaLabel: 'Inline code',
        className: editor.isActive('code') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleCode().run(),
        onClick: () => editor.chain().focus().toggleCode().run(),
        icon: FormatInlineCodeIcon,
      },
      {
        ariaLabel: 'Link',
        className: editor.isActive('link') ? 'is-active' : '',
        disabled: false,
        onClick: () => toggleLink(),
        icon: FormatLinkIcon,
      },
    ];

    return { menuList };
  }, [editor]);

  return (
    <CoreBubbleMenu className="menu-wrapper" editor={editor}>
      {menuList.map(
        ({ icon: Icon, ariaLabel, className, disabled, onClick }) => (
          <Tooltip key={ariaLabel} title={ariaLabel}>
            <Button
              aria-label={ariaLabel}
              className={classNames('p-0', className)}
              disabled={disabled}
              type="text"
              onClick={onClick}>
              {isString(Icon) ? (
                <Typography>{Icon}</Typography>
              ) : (
                <Icon className="d-flex" height={24} width={24} />
              )}
            </Button>
          </Tooltip>
        )
      )}
    </CoreBubbleMenu>
  );
};

export default BubbleMenu;
