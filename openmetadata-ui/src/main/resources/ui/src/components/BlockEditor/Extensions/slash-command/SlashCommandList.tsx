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
import { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { Image, Space, Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { isInViewport } from '../../../../utils/BlockEditorUtils';
import { useEntityAttachment } from '../../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider';

export interface SlashCommandRef {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export const SlashCommandList = forwardRef<SlashCommandRef, SuggestionProps>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { items, command } = props;
    const { allowFileUpload } = useEntityAttachment();

    // Filter out file commands if file upload is not allowed
    const filteredItems = items.filter(
      (item) => !item.isFileCommand || allowFileUpload
    );

    const selectItem = (index: number) => {
      const item = filteredItems[index];

      if (item) {
        command(item);
      }
    };

    const upHandler = () => {
      setSelectedIndex((prev) => {
        const newIndex =
          (prev + filteredItems.length - 1) % filteredItems.length;
        const commandListing = document.getElementById(
          `editor-command-${filteredItems[newIndex].title}`
        );
        const commandList = document.getElementById('editor-commands-viewport');
        if (
          commandList &&
          commandListing &&
          !isInViewport(commandListing, commandList)
        ) {
          commandListing.scrollIntoView();
        }

        return newIndex;
      });
    };

    const downHandler = () => {
      setSelectedIndex((prev) => {
        const newIndex = (prev + 1) % filteredItems.length;
        const commandListing = document.getElementById(
          `editor-command-${filteredItems[newIndex].title}`
        );
        const commandList = document.getElementById('editor-commands-viewport');
        if (
          commandList &&
          commandListing &&
          !isInViewport(commandListing, commandList)
        ) {
          commandListing.scrollIntoView();
        }

        return newIndex;
      });
    };

    const enterHandler = () => {
      selectItem(selectedIndex);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === 'ArrowUp') {
          upHandler();

          return true;
        }

        if (event.key === 'ArrowDown') {
          downHandler();

          return true;
        }

        if (event.key === 'Enter') {
          enterHandler();

          return true;
        }

        return false;
      },
    }));

    if (isEmpty(filteredItems)) {
      return null;
    }

    return (
      <Space
        className="slash-menu-wrapper"
        direction="vertical"
        id="editor-commands-viewport">
        {filteredItems.map((item, index) => (
          <Space
            className={classNames('w-full cursor-pointer slash-command-item', {
              'bg-grey-2': index === selectedIndex,
            })}
            id={`editor-command-${item.title}`}
            key={item.title}
            onClick={() => selectItem(index)}>
            <Image
              className={classNames('slash-command-image', {
                'svg-image': item.isSvg,
              })}
              preview={false}
              src={item.imgSrc}
            />
            <Space direction="vertical" size={0}>
              <Typography className="font-bold">{item.title}</Typography>
              <Typography>{item.description}</Typography>
            </Space>
          </Space>
        ))}
      </Space>
    );
  }
);
