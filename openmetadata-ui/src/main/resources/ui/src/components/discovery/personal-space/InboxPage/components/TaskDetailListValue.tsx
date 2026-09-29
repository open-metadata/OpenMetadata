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
  Button,
  Dropdown,
  Typography,
} from '@openmetadata/ui-core-components';
import React from 'react';
import { useTranslation } from 'react-i18next';

// Enough names to recognise the request at a glance; the rest wait a click.
const INLINE_ITEM_COUNT = 4;

export interface TaskDetailListValueProps {
  items: string[];
  /** Heads the menu that lists every item; already translated. */
  title: string;
}

/**
 * A long list in a detail row: the first few items inline, then "View N more"
 * opening the app's standard dropdown with the full list, so twenty requested
 * columns do not stretch the row into a paragraph.
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
        <Dropdown.Root>
          <Button
            className="tw:ml-2 tw:inline"
            color="link-color"
            data-testid="task-detail-list-more"
            size="sm">
            {t('label.view-more-count', { countValue: hiddenCount })}
          </Button>
          <Dropdown.Popover className="tw:w-64" placement="bottom start">
            <Dropdown.Menu
              aria-label={title}
              className="tw:max-h-64 tw:overflow-y-auto"
              data-testid="task-detail-list-popover"
              // A read-only list: nothing to pick, so no radio state.
              selectionMode="none">
              <Dropdown.Section>
                <Dropdown.SectionHeader className="tw:flex tw:items-center tw:justify-between tw:px-3 tw:py-1.5">
                  <Typography size="text-sm" weight="semibold">
                    {title}
                  </Typography>
                  <Badge color="gray" size="sm" type="pill-color">
                    {items.length}
                  </Badge>
                </Dropdown.SectionHeader>
                {items.map((item) => (
                  <Dropdown.Item id={item} key={item} label={item} />
                ))}
              </Dropdown.Section>
            </Dropdown.Menu>
          </Dropdown.Popover>
        </Dropdown.Root>
      )}
    </Typography>
  );
};

export default TaskDetailListValue;
