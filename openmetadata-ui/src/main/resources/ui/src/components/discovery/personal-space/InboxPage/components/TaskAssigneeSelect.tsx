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

import { Autocomplete } from '@openmetadata/ui-core-components';
import { User01 } from '@untitledui/icons';
import { debounce } from 'lodash';
import ProfilePicture from '../../../../../components/common/ProfilePicture/ProfilePicture';
import { EntityType } from '../../../../../enums/entity.enum';
import { SearchIndex } from '../../../../../enums/search.enum';
import { EntityReference } from '../../../../../generated/entity/type';
import { searchData } from '../../../../../rest/miscAPI';
import { formatUsersResponse } from '../../../../../utils/APIUtils';
import { getEntityName } from '../../../../../utils/EntityNameUtils';
import { getEntityReferenceListFromEntities } from '../../../../../utils/EntityReferenceUtils';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

export interface TaskAssigneeSelectProps {
  selected?: EntityReference;
  isDisabled?: boolean;
  isInvalid?: boolean;
  hint?: string;
  onChange: (assignee?: EntityReference) => void;
}

/**
 * Single assignee picker for the task action modal: a reassign hands the task to
 * one person, so this lists users only — never teams.
 */
const TaskAssigneeSelect: React.FC<TaskAssigneeSelectProps> = ({
  selected,
  isDisabled,
  isInvalid,
  hint,
  onChange,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const [options, setOptions] = useState<EntityReference[]>([]);
  // Only the newest search may write the options, so a slow early response
  // cannot overwrite a faster later one.
  const latestRequestId = useRef(0);

  const fetchOptions = useCallback(async (searchText: string) => {
    const requestId = ++latestRequestId.current;
    try {
      const response = await searchData(
        searchText,
        1,
        PAGE_SIZE,
        'isBot:false',
        'displayName.keyword',
        'asc',
        SearchIndex.USER
      );

      if (requestId !== latestRequestId.current) {
        return;
      }

      setOptions(
        getEntityReferenceListFromEntities(
          formatUsersResponse(response.data.hits.hits),
          EntityType.USER
        )
      );
    } catch {
      if (requestId === latestRequestId.current) {
        setOptions([]);
      }
    }
  }, []);

  const debouncedFetch = useMemo(
    () => debounce(fetchOptions, SEARCH_DEBOUNCE_MS),
    [fetchOptions]
  );

  useEffect(() => {
    void fetchOptions('');

    return () => debouncedFetch.cancel();
  }, [fetchOptions, debouncedFetch]);

  const items = useMemo(
    () =>
      options.map((option) => ({
        id: option.id,
        label: getEntityName(option),
      })),
    [options]
  );
  const selectedItems = useMemo(
    () =>
      selected ? [{ id: selected.id, label: getEntityName(selected) }] : [],
    [selected]
  );

  const renderTag = useCallback(
    (item: { id: string | number; label?: string }) => (
      <span
        className="tw:flex tw:items-center tw:gap-1.5 tw:rounded-md tw:bg-primary tw:py-1.5 tw:px-2.5 tw:outline-1 tw:-outline-offset-1 tw:outline-primary"
        key={item.id}>
        <ProfilePicture
          displayName={item.label ?? ''}
          name={selected?.name ?? ''}
          width="16"
        />
        <span className="tw:truncate tw:font-medium tw:text-secondary">
          {item.label}
        </span>
      </span>
    ),
    [selected]
  );

  return (
    <Autocomplete
      isRequired
      data-testid="task-action-assignee"
      hint={hint}
      icon={User01}
      isDisabled={isDisabled}
      isInvalid={isInvalid}
      items={items}
      label={t('label.assign-to')}
      // Library single-select: it refuses a second pick and hides the input once
      // one is chosen. The blur below then closes the listbox, whose popover
      // would otherwise sit over the dialog footer.
      multiple={false}
      placeholder={t('label.select-team-member')}
      // Core allows 320px; that overshoots this short dialog.
      popoverClassName="tw:max-h-56!"
      ref={containerRef}
      renderTag={renderTag}
      selectedItems={selectedItems}
      onItemCleared={() => onChange(undefined)}
      onItemInserted={(key) => {
        onChange(options.find((option) => option.id === String(key)));
        containerRef.current?.querySelector('input')?.blur();
      }}
      onSearchChange={debouncedFetch}>
      {(item) => (
        <Autocomplete.Item id={String(item.id)} key={item.id}>
          <div className="tw:flex tw:items-center tw:gap-2">
            <ProfilePicture
              displayName={item.label ?? ''}
              name={
                options.find((option) => option.id === String(item.id))?.name ??
                ''
              }
              width="20"
            />
            <span className="tw:text-sm tw:font-medium tw:text-primary">
              {item.label}
            </span>
          </div>
        </Autocomplete.Item>
      )}
    </Autocomplete>
  );
};

export default TaskAssigneeSelect;
