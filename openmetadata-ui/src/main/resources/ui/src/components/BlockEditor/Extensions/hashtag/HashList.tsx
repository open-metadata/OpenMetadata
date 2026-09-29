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
import { Box, Typography } from '@openmetadata/ui-core-components';
import { SuggestionProps } from '@tiptap/suggestion';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { isInViewport } from '../../../../utils/BlockEditorPureUtils';
import { EntityIconSize } from '../../../../utils/EntityIconUtils';
import searchClassBase from '../../../../utils/SearchClassBase';
import { renderBreakableTooltip } from '../../../../utils/TooltipUtils';
import { ExtensionRef, SuggestionItem } from '../../BlockEditor.interface';

export default forwardRef<
  ExtensionRef,
  SuggestionProps<
    SuggestionItem & { breadcrumbs: { name: string; url: string }[] }
  >
>((props, ref) => {
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
        `hashtag-item-${items[newIndex]?.id}`
      );
      const commandList = document.getElementById('hashtag-viewport');
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
        `hashtag-item-${items[newIndex]?.id}`
      );
      const commandList = document.getElementById('hashtag-viewport');
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
      // Allow default behavior when there are no items
      if (isEmpty(items)) {
        return false;
      }

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
    <div className="suggestion-menu-wrapper" id="hashtag-viewport">
      {items.map((item, index) => {
        const breadcrumbsData = item.breadcrumbs
          ? item.breadcrumbs.map((obj: { name: string }) => obj.name).join('/')
          : '';

        return (
          <button
            className={classNames(
              'tw:w-full tw:cursor-pointer hashtag-item tw:flex tw:items-start tw:flex-col',
              {
                'bg-grey-2': index === selectedIndex,
              }
            )}
            data-testid={`hash-mention-${item.label}`}
            id={`hashtag-item-${item.id}`}
            key={item.id}
            type="button"
            onClick={() => selectItem(index)}>
            <div className="tw:w-full tw:min-w-0 tw:flex tw:flex-wrap">
              <Typography
                className="tw:text-quaternary tw:block tw:text-left tw:min-w-0"
                ellipsis={{ tooltip: renderBreakableTooltip(breadcrumbsData) }}
                size="text-xs">
                {breadcrumbsData}
              </Typography>
            </div>
            <Box align="center" className="tw:min-w-0" gap={2}>
              {searchClassBase.getEntityIconWithBg(
                item.type,
                EntityIconSize.Size14
              )}
              <Typography
                className="tw:block tw:text-left tw:min-w-0"
                ellipsis={{ tooltip: renderBreakableTooltip(item.label) }}>
                {item.label}
              </Typography>
            </Box>
          </button>
        );
      })}
    </div>
  );
});
