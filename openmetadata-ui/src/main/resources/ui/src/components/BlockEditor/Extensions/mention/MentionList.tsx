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
import { SuggestionProps } from '@tiptap/suggestion';
import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { forwardRef, useImperativeHandle, useState } from 'react';
import ProfilePicture from '../../../../components/common/ProfilePicture/ProfilePicture';
import { isInViewport } from '../../../../utils/BlockEditorUtils';
import { ExtensionRef, SuggestionItem } from '../../BlockEditor.interface';

export default forwardRef<ExtensionRef, SuggestionProps<SuggestionItem>>(
  (props, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const { items, command } = props;

    const selectItem = (index: number) => {
      const item = items[index];

      if (item) {
        command(item);
      }
    };

    const upHandler = () => {
      setSelectedIndex((prev) => {
        const newIndex = (prev + items.length - 1) % items.length;
        const commandListing = document.getElementById(
          `mention-item-${items[newIndex].id}`
        );
        const commandList = document.getElementById('mention-viewport');
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
        const newIndex = (prev + 1) % items.length;
        const commandListing = document.getElementById(
          `mention-item-${items[newIndex].id}`
        );
        const commandList = document.getElementById('mention-viewport');
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

    return (
      <Space
        className="suggestion-menu-wrapper"
        direction="vertical"
        id="mention-viewport">
        {items.map((item, index) => (
          <Space
            className={classNames('w-full cursor-pointer mention-item', {
              'bg-grey-2': index === selectedIndex,
            })}
            id={`mention-item-${item.id}`}
            key={item.id}
            onClick={() => selectItem(index)}>
            <ProfilePicture name={item.name} width="20" />
            <Typography className="truncate w-max-200">{item.label}</Typography>
          </Space>
        ))}
      </Space>
    );
  }
);
