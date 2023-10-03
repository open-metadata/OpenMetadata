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
import { Button, Dropdown, Tooltip, Typography } from 'antd';
import { TitleProps } from 'antd/lib/typography/Title';
import classNames from 'classnames';
import React, { FC, useMemo } from 'react';
import { ReactComponent as FormatBoldIcon } from '../../../assets/svg/ic-format-bold.svg';
import { ReactComponent as FormatBulletListIcon } from '../../../assets/svg/ic-format-bullet-list.svg';
import { ReactComponent as FormatCodeBlockIcon } from '../../../assets/svg/ic-format-code-block.svg';
import { ReactComponent as FormatDividerIcon } from '../../../assets/svg/ic-format-divider.svg';
import { ReactComponent as FormatInlineCodeIcon } from '../../../assets/svg/ic-format-inline-code.svg';
import { ReactComponent as FormatItalicIcon } from '../../../assets/svg/ic-format-italic.svg';
import { ReactComponent as FormatLinkIcon } from '../../../assets/svg/ic-format-link.svg';
import { ReactComponent as FormatNumberListIcon } from '../../../assets/svg/ic-format-numbered-list.svg';
import { ReactComponent as FormatQuoteIcon } from '../../../assets/svg/ic-format-quote.svg';
import { ReactComponent as FormatStrikeIcon } from '../../../assets/svg/ic-format-strike.svg';

interface BubbleMenuProps {
  editor: Editor;
  toggleLink: () => void;
}

const BubbleMenu: FC<BubbleMenuProps> = ({ editor, toggleLink }) => {
  const { menuList, headings } = useMemo(() => {
    const menuList = [
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
        ariaLabel: 'Code',
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
      {
        ariaLabel: 'Bullet List',
        className: editor.isActive('bulletList') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleBulletList().run(),
        icon: FormatBulletListIcon,
      },
      {
        ariaLabel: 'Ordered List',
        className: editor.isActive('orderedList') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
        icon: FormatNumberListIcon,
      },
      {
        ariaLabel: 'Code block',
        className: editor.isActive('codeBlock') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleCodeBlock().run(),
        icon: FormatCodeBlockIcon,
      },
      {
        ariaLabel: 'Blockquote',
        className: editor.isActive('blockquote') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
        icon: FormatQuoteIcon,
      },
      {
        ariaLabel: 'Horizontal Line',
        className: '',
        disabled: false,
        onClick: () => editor.chain().focus().setHorizontalRule().run(),
        icon: FormatDividerIcon,
      },
    ];

    const headings = [
      {
        label: 'Heading 1',
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        level: 1,
      },
      {
        label: 'Heading 2',
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        level: 2,
      },
      {
        label: 'Heading 3',
        onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        level: 3,
      },
    ];

    return { menuList, headings };
  }, [editor]);

  return (
    <CoreBubbleMenu className="menu-wrapper" editor={editor}>
      <Dropdown.Button
        className="headings-dropdown"
        icon={<i>H</i>}
        menu={{
          items: headings.map(({ label, level, onClick }) => ({
            key: label,
            icon: (
              <Typography.Title
                className="m-b-0"
                level={(level + 2) as TitleProps['level']}>
                {label}
              </Typography.Title>
            ),
            onClick,
          })),
        }}
        type="text"
      />
      {menuList.map(
        ({ icon: Icon, ariaLabel, className, disabled, onClick }) => (
          <Tooltip key={ariaLabel} title={ariaLabel}>
            <Button
              aria-label={ariaLabel}
              className={classNames('p-0', className)}
              disabled={disabled}
              type="text"
              onClick={onClick}>
              <Icon className="d-flex" height={24} width={24} />
            </Button>
          </Tooltip>
        )
      )}
    </CoreBubbleMenu>
  );
};

export default BubbleMenu;
