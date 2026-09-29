/*
 *  Copyright 2026 Collate.
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
import {
  Badge,
  Box,
  Button,
  Popover,
  PopoverTrigger,
  Typography,
} from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';

// Enough names to recognise the request at a glance; the rest wait a click.
const INLINE_ITEM_COUNT = 4;

export interface TaskDetailListValueProps {
  items: string[];
  /** Heads the popover that lists every item; already translated. */
  title: string;
}

/**
 * A long list in a detail row: the first few items inline, then "View N more"
 * opening a popover with the full list, so twenty requested columns do not
 * stretch the row into a paragraph.
 */
const TaskDetailListValue: React.FC<TaskDetailListValueProps> = ({
  items,
  title,
}) => {
  const { t } = useTranslation();
  const hiddenCount = items.length - INLINE_ITEM_COUNT;

  return (
    <Typography size="text-sm">
      {items.slice(0, INLINE_ITEM_COUNT).join(', ')}
      {hiddenCount > 0 && (
        <PopoverTrigger>
          <Button
            className="tw:ml-2 tw:inline"
            color="link-color"
            data-testid="task-detail-list-more"
            size="sm">
            {t('label.view-more-count', { countValue: hiddenCount })}
          </Button>
          <Popover arrow className="tw:w-80" placement="bottom start">
            <Box data-testid="task-detail-list-popover" direction="col">
              <Box
                align="center"
                className="tw:justify-between tw:border-b tw:border-secondary tw:px-4 tw:py-3"
                gap={2}>
                <Typography size="text-sm" weight="semibold">
                  {title}
                </Typography>
                <Badge color="gray" size="sm" type="pill-color">
                  {items.length}
                </Badge>
              </Box>
              <ul className="tw:m-0 tw:max-h-64 tw:list-none tw:overflow-y-auto tw:px-4 tw:py-2">
                {items.map((item) => (
                  <li
                    className="tw:py-1 tw:font-mono tw:text-sm tw:text-secondary"
                    key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </Box>
          </Popover>
        </PopoverTrigger>
      )}
    </Typography>
  );
};

export default TaskDetailListValue;
