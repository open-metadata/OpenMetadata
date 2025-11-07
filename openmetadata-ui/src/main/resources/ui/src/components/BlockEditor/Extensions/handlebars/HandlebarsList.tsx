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
import { Box, Chip, Grid, Stack } from '@mui/material';
import { SuggestionProps } from '@tiptap/suggestion';
import { Typography } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { forwardRef, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as FunctionIcon } from '../../../../assets/svg/ic-function.svg';
import { ReactComponent as VariableIcon } from '../../../../assets/svg/ic-variable.svg';
import { isInViewport } from '../../../../utils/BlockEditorUtils';
import { ExtensionRef } from '../../BlockEditor.interface';

export interface HandlebarsItem {
  id: string;
  name: string;
  label: string;
  type: 'helper' | 'variable';
  description?: string;
  syntax?: string; // Full syntax template for helpers
  cursorOffset?: number; // Where to place cursor after insertion
}

export default forwardRef<ExtensionRef, SuggestionProps<HandlebarsItem>>(
  (props, ref) => {
    const { t } = useTranslation();
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
          `handlebars-item-${items[newIndex]?.id}`
        );
        const commandList = document.getElementById('handlebars-viewport');
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
          `handlebars-item-${items[newIndex]?.id}`
        );
        const commandList = document.getElementById('handlebars-viewport');
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

    const getIcon = (type: 'helper' | 'variable') => {
      if (type === 'helper') {
        return <FunctionIcon height={16} width={16} />;
      }

      return <VariableIcon height={16} width={16} />;
    };

    return (
      <Stack className="suggestion-menu-wrapper" id="handlebars-viewport">
        {items.map((item, index) => (
          <Box
            className={classNames(
              'w-full cursor-pointer handlebars-item p-xss',
              {
                'bg-grey-2': index === selectedIndex,
              }
            )}
            id={`handlebars-item-${item.id}`}
            key={item.id}
            onClick={() => selectItem(index)}>
            <Grid
              container
              alignItems="center"
              className="w-full"
              display="flex"
              spacing={2}>
              <Grid alignItems="center" display="flex">
                {getIcon(item.type)}
              </Grid>

              <Stack className="flex-1">
                <Grid container alignItems="center" display="flex" spacing={1}>
                  <Typography className="text-sm">{item.label}</Typography>
                  <Chip
                    color={item.type === 'helper' ? 'primary' : 'success'}
                    label={
                      item.type === 'helper'
                        ? t('label.helper')
                        : t('label.placeholder')
                    }
                    size="small"
                    sx={{
                      fontSize: '10px',
                      lineHeight: '12px',
                    }}
                  />
                </Grid>
                {item.description && (
                  <Typography className="text-xs text-grey-muted">
                    {item.description}
                  </Typography>
                )}
              </Stack>
            </Grid>
          </Box>
        ))}
      </Stack>
    );
  }
);
