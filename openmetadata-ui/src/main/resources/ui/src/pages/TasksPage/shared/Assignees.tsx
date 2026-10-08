/*
 *  Copyright 2022 Collate.
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

import { Autocomplete, Typography } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { debounce, isEmpty, isString, uniqBy } from 'lodash';
import { FC, useEffect, useMemo, useRef } from 'react';
import { Header, ListBoxSection } from 'react-aria-components';
import { useTranslation } from 'react-i18next';
import { ReactComponent as TeamIcon } from '../../../assets/svg/teams-grey.svg';
import { UserTag } from '../../../components/common/UserTag/UserTag.component';
import { UserTagSize } from '../../../components/common/UserTag/UserTag.interface';
import { OwnerType } from '../../../enums/user.enum';
import { ensureComboboxMenuOpen } from '../../../utils/formPureUtils';
import { Option } from '../TasksPage.interface';
import './Assignee.less';

interface Props {
  options: Option[];
  // antd Form.setFieldValue callers can seed the field with bare ids.
  value: Array<Option | string>;
  onSearch: (value: string) => void;
  onChange: (values: Option[]) => void;
  disabled?: boolean;
  isSingleSelect?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
  // Accepted for existing callers; removing the selected chip always clears.
  allowClear?: boolean;
  showArrow?: boolean;
}

const getOptionValue = (option: Option | string) =>
  isString(option) ? option : option.value;

const Assignees: FC<Props> = ({
  value: assignees = [],
  onSearch,
  onChange,
  options,
  disabled,
  isSingleSelect = false,
  id,
  className,
  placeholder,
  allowClear: _allowClear,
  showArrow: _showArrow,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const onSearchRef = useRef(onSearch);
  onSearchRef.current = onSearch;

  const debouncedSearch = useMemo(
    () => debounce((query: string) => onSearchRef.current(query), 300),
    []
  );

  useEffect(() => () => debouncedSearch.cancel(), [debouncedSearch]);

  const optionMap = useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options]
  );

  // Only selected assignees are remembered, so they stay resolvable after a
  // new search replaces `options` without the map growing with every search.
  const selectedOptionsRef = useRef(new Map<string, Option>());
  const selectedOptions = useMemo(() => {
    const next = new Map<string, Option>();
    assignees.forEach((assignee) => {
      const value = getOptionValue(assignee);
      const option =
        optionMap.get(value) ??
        (isString(assignee) ? undefined : assignee) ??
        selectedOptionsRef.current.get(value);
      if (option) {
        next.set(value, option);
      }
    });
    selectedOptionsRef.current = next;

    return next;
  }, [assignees, optionMap]);

  const resolveOption = (value: string) =>
    optionMap.get(value) ?? selectedOptions.get(value);

  const selectedValues = useMemo(
    () => assignees.map(getOptionValue),
    [assignees]
  );

  const selectedItems = useMemo(
    () =>
      selectedValues.map((value) => {
        const option = selectedOptions.get(value);

        return {
          id: value,
          label: option?.label || option?.displayName || option?.name || value,
        };
      }),
    [selectedValues, selectedOptions]
  );

  const items = useMemo(
    () =>
      uniqBy(options, 'value').map((option) => ({
        id: option.value,
        label: option.label,
      })),
    [options]
  );

  const emitChange = (values: string[]) => {
    if (isSingleSelect && isEmpty(values)) {
      onChange(undefined as unknown as Option[]);

      return;
    }

    onChange(
      values.map((value) => {
        const option = resolveOption(value);

        return {
          label: option?.['data-label'],
          value,
          type: option?.type,
          name: option?.name,
          displayName: option?.displayName,
        } as Option;
      })
    );
  };

  const { teams, users } = useMemo(() => {
    const unselected = uniqBy(options, 'value').filter(
      (option) => !selectedValues.includes(option.value)
    );

    return {
      teams: unselected.filter((option) => option.type === OwnerType.TEAM),
      users: unselected.filter((option) => option.type === OwnerType.USER),
    };
  }, [options, selectedValues]);

  const sectionHeaderClass =
    'tw:px-3.5 tw:pt-2 tw:pb-1 tw:text-xs tw:font-medium tw:text-tertiary';

  return (
    <div
      className={classNames('select-assignee', className)}
      ref={containerRef}>
      {/* Always `multiple`: single select replaces the pick (as antd did)
          instead of locking the input until the chip is removed. */}
      <Autocomplete
        multiple
        aria-label={placeholder ?? t('label.assignee-plural')}
        data-testid="select-assignee"
        filterOption={() => true}
        icon={null}
        id={id}
        isDisabled={disabled}
        items={items}
        placeholder={placeholder ?? t('label.select-to-search')}
        selectedItems={selectedItems}
        onItemCleared={(key) =>
          emitChange(selectedValues.filter((value) => value !== String(key)))
        }
        onItemInserted={(key) => {
          if (isSingleSelect) {
            emitChange([String(key)]);

            return;
          }
          emitChange([...selectedValues, String(key)]);
          // antd kept a multi select open after a pick; do the same.
          ensureComboboxMenuOpen(() =>
            containerRef.current?.querySelector('input')
          );
        }}
        onSearchChange={debouncedSearch}>
        {[
          teams.length > 0 && (
            <ListBoxSection id={OwnerType.TEAM} key={OwnerType.TEAM}>
              <Header className={sectionHeaderClass}>
                {t('label.team-plural')}
              </Header>
              {teams.map((team) => (
                <Autocomplete.Item
                  data-testid={team.name}
                  id={team.value}
                  key={team.value}
                  textValue={team.label}>
                  <div className="d-flex items-center">
                    <TeamIcon
                      className="vertical-middle m-r-xs"
                      height={16}
                      width={16}
                    />
                    <Typography>{team.label}</Typography>
                  </div>
                </Autocomplete.Item>
              ))}
            </ListBoxSection>
          ),
          users.length > 0 && (
            <ListBoxSection id={OwnerType.USER} key={OwnerType.USER}>
              <Header className={sectionHeaderClass}>
                {t('label.user-plural')}
              </Header>
              {users.map((user) => (
                <Autocomplete.Item
                  data-testid={user.name}
                  id={user.value}
                  key={user.value}
                  textValue={user.label}>
                  <UserTag
                    className="assignee-item"
                    id={user.name ?? ''}
                    name={user.label}
                    size={UserTagSize.small}
                  />
                </Autocomplete.Item>
              ))}
            </ListBoxSection>
          ),
        ].filter(Boolean)}
      </Autocomplete>
    </div>
  );
};

export default Assignees;
