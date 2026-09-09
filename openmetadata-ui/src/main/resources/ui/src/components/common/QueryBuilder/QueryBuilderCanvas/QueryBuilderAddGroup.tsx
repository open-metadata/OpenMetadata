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
import { Button, Dropdown } from '@openmetadata/ui-core-components';
import { ChevronDown, Plus } from '@untitledui/icons';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import type { QueryBuilderAddGroupProps } from './QueryBuilderCanvas.types';

/**
 * Adds a group beside the ones already there.
 *
 * Adding a group means saying how it joins them, so the conjunction is picked
 * on the way in rather than corrected afterwards — the connector between the
 * cards then shows what was chosen. A caller with a single conjunction
 * configured has nothing to pick, and gets a plain button.
 */
const QueryBuilderAddGroup: FC<QueryBuilderAddGroupProps> = ({
  conjunctions,
  testId,
  onAdd,
}) => {
  const { t } = useTranslation();
  const label = t('label.add-entity', { entity: t('label.group') });

  if (conjunctions.length <= 1) {
    return (
      <Button
        className="tw:mt-5 tw:self-start"
        data-testid={testId}
        iconLeading={Plus}
        size="sm"
        onClick={() => onAdd(conjunctions[0])}>
        {label}
      </Button>
    );
  }

  return (
    <Dropdown.Root>
      <Button
        className="tw:mt-5 tw:self-start"
        data-testid={testId}
        iconLeading={Plus}
        iconTrailing={<ChevronDown className="tw:size-4" />}
        size="sm">
        {label}
      </Button>

      <Dropdown.Popover className="tw:w-max" placement="bottom left">
        <Dropdown.Menu items={conjunctions.map((id) => ({ id }))}>
          {(item: { id: string }) => (
            <Dropdown.Item
              data-testid={`${testId}-${item.id.toLowerCase()}`}
              id={item.id}
              label={item.id}
              onAction={() => onAdd(item.id)}
            />
          )}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

export default QueryBuilderAddGroup;
