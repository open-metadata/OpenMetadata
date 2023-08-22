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
import { Button } from 'antd';
import React, { FC } from 'react';

interface BubbleMenuProps {
  editor: Editor;
}

const MenuIconMap = {
  BOLD: 'B',
  ITALIC: 'I',
  STRIKE: 'Strike',
  CODE: 'Code',
  PARAGRAPH: 'Paragraph',
  BULLET_LIST: 'Bullet list',
  ORDERED_LIST: 'Ordered list',
  CODE_BLOCK: 'Code block',
  BLOCK_QUOTE: 'blockquote',
  HORIZONTAL_LINE: 'Horizontal line',
};

const BubbleMenu: FC<BubbleMenuProps> = ({ editor }) => {
  return (
    <CoreBubbleMenu className="menu-wrapper" editor={editor}>
      <Button
        aria-label="Bold"
        className={editor.isActive('bold') ? 'is-active' : ''}
        disabled={!editor.can().chain().focus().toggleBold().run()}
        onClick={() => editor.chain().focus().toggleBold().run()}>
        {MenuIconMap.BOLD}
      </Button>
      <Button
        aria-label="Italic"
        className={editor.isActive('italic') ? 'is-active' : ''}
        disabled={!editor.can().chain().focus().toggleItalic().run()}
        onClick={() => editor.chain().focus().toggleItalic().run()}>
        {MenuIconMap.ITALIC}
      </Button>
      <Button
        className={editor.isActive('strike') ? 'is-active' : ''}
        disabled={!editor.can().chain().focus().toggleStrike().run()}
        onClick={() => editor.chain().focus().toggleStrike().run()}>
        {MenuIconMap.STRIKE}
      </Button>
      <Button
        className={editor.isActive('code') ? 'is-active' : ''}
        disabled={!editor.can().chain().focus().toggleCode().run()}
        onClick={() => editor.chain().focus().toggleCode().run()}>
        {MenuIconMap.CODE}
      </Button>
      <Button
        className={editor.isActive('paragraph') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().setParagraph().run()}>
        {MenuIconMap.PARAGRAPH}
      </Button>
      <Button
        className={editor.isActive('bulletList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBulletList().run()}>
        {MenuIconMap.BULLET_LIST}
      </Button>
      <Button
        className={editor.isActive('orderedList') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        {MenuIconMap.ORDERED_LIST}
      </Button>
      <Button
        className={editor.isActive('codeBlock') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        {MenuIconMap.CODE_BLOCK}
      </Button>
      <Button
        className={editor.isActive('blockquote') ? 'is-active' : ''}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        {MenuIconMap.BLOCK_QUOTE}
      </Button>
      <Button onClick={() => editor.chain().focus().setHorizontalRule().run()}>
        {MenuIconMap.HORIZONTAL_LINE}
      </Button>
    </CoreBubbleMenu>
  );
};

export default BubbleMenu;
