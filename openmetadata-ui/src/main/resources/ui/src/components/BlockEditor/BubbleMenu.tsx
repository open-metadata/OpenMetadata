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
import { Button, Dropdown } from 'antd';
import { ReactComponent as IconMore } from 'assets/svg/ic-three-dots.svg';
import React, { FC, useMemo } from 'react';

interface BubbleMenuProps {
  editor: Editor;
}

const BubbleMenu: FC<BubbleMenuProps> = ({ editor }) => {
  const { menuList, headings } = useMemo(() => {
    const menuList = [
      {
        ariaLabel: 'Bold',
        className: editor.isActive('bold') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleBold().run(),
        onClick: () => editor.chain().focus().toggleBold().run(),
        icon: 'B',
      },
      {
        ariaLabel: 'Italic',
        className: editor.isActive('italic') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleItalic().run(),
        onClick: () => editor.chain().focus().toggleItalic().run(),
        icon: 'I',
      },
      {
        ariaLabel: 'Strike',
        className: editor.isActive('strike') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleStrike().run(),
        onClick: () => editor.chain().focus().toggleStrike().run(),
        icon: '$',
      },
      {
        ariaLabel: 'Code',
        className: editor.isActive('code') ? 'is-active' : '',
        disabled: !editor.can().chain().focus().toggleCode().run(),
        onClick: () => editor.chain().focus().toggleCode().run(),
        icon: '</>',
      },
      {
        ariaLabel: 'Paragraph',
        className: editor.isActive('paragraph') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().setParagraph().run(),
        icon: 'P',
      },
      {
        ariaLabel: 'Bullet List',
        className: editor.isActive('bulletList') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleBulletList().run(),
        icon: 'Ul',
      },
      {
        ariaLabel: 'Ordered List',
        className: editor.isActive('orderedList') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleOrderedList().run(),
        icon: 'Ol',
      },
      {
        ariaLabel: 'Code block',
        className: editor.isActive('codeBlock') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleCodeBlock().run(),
        icon: '</>B',
      },
      {
        ariaLabel: 'Blockquote',
        className: editor.isActive('blockquote') ? 'is-active' : '',
        disabled: false,
        onClick: () => editor.chain().focus().toggleBlockquote().run(),
        icon: '>',
      },
      {
        ariaLabel: 'Horizontal Line',
        className: '',
        disabled: false,
        onClick: () => editor.chain().focus().setHorizontalRule().run(),
        icon: '--',
      },
    ];

    const headings = [
      {
        label: 'Heading 1',
        onClick: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      },
      {
        label: 'Heading 2',
        onClick: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      },
      {
        label: 'Heading 3',
        onClick: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
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
          items: headings.map((heading) => ({
            key: heading.label,
            icon: heading.label,
            onClick: heading.onClick,
          })),
        }}
        type="text"
      />
      {menuList.slice(0, 6).map((menu) => (
        <Button
          aria-label={menu.ariaLabel}
          className={menu.className}
          disabled={menu.disabled}
          key={menu.ariaLabel}
          title={menu.ariaLabel}
          type="text"
          onClick={menu.onClick}>
          {menu.icon}
        </Button>
      ))}
      <Dropdown.Button
        className="more-menu-items"
        icon={<IconMore height={16} width={16} />}
        menu={{
          items: menuList.slice(6).map((menu) => ({
            icon: menu.ariaLabel,
            key: menu.ariaLabel,
            onClick: menu.onClick,
          })),
        }}
        type="text"
      />
    </CoreBubbleMenu>
  );
};

export default BubbleMenu;
