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

import { Select, SelectProps, Space, Typography } from 'antd';
import { DefaultOptionType } from 'antd/lib/select';
import { t } from 'i18next';
import { debounce, groupBy, isArray, isUndefined } from 'lodash';
import React, { FC, useMemo } from 'react';
import { ReactComponent as TeamIcon } from '../../../assets/svg/teams-grey.svg';
import { UserTag } from '../../../components/common/UserTag/UserTag.component';
import { UserTagSize } from '../../../components/common/UserTag/UserTag.interface';
import { OwnerType } from '../../../enums/user.enum';
import { Option } from '../TasksPage.interface';
import './Assignee.less';

interface Props
  extends Omit<
    SelectProps<Option[], DefaultOptionType>,
    'onChange' | 'onSearch' | 'value' | 'options'
  > {
  options: Option[];
  value: Option[];
  onSearch: (value: string) => void;
  onChange: (values: Option[]) => void;
  disabled?: boolean;
  isSingleSelect?: boolean;
}

const Assignees: FC<Props> = ({
  value: assignees = [],
  onSearch,
  onChange,
  options,
  disabled,
  isSingleSelect = false,
  ...rest
}) => {
  const handleOnChange = (
    _values: Option[],
    newOptions: DefaultOptionType | DefaultOptionType[]
  ) => {
    const newValues = isUndefined(newOptions)
      ? newOptions
      : (isArray(newOptions) ? newOptions : [newOptions]).map((option) => ({
          label: option['data-label'],
          value: option.value,
          type: option.type,
          name: option.name,
        }));

    onChange(newValues as Option[]);
  };

  const updatedOption = useMemo(() => {
    const groupByType = groupBy(options, (d) => d.type);
    const groupOptions = [];
    if (!isUndefined(groupByType.team)) {
      groupOptions.push({
        type: 'group',
        label: 'Teams',
        value: OwnerType.TEAM,
        options: groupByType.team.map((team) => ({
          ...team,
          label: (
            <Space data-testid="assignee-option" key={team.value}>
              <TeamIcon height={16} width={16} />
              <Typography.Text>{team.label}</Typography.Text>
            </Space>
          ),
        })),
      });
    }
    if (!isUndefined(groupByType.user)) {
      groupOptions.push({
        type: 'group',
        label: 'Users',
        value: OwnerType.USER,
        options: groupByType.user.map((user) => ({
          ...user,
          label: (
            <div data-testid={`assignee-option-${user.label}`}>
              <UserTag
                className="assignee-item"
                id={user.name ?? ''}
                name={user.label}
                size={UserTagSize.small}
              />
            </div>
          ),
        })),
      });
    }

    return groupOptions;
  }, [options]);

  return (
    <Select
      showSearch
      className="ant-select-custom select-assignee"
      data-testid="select-assignee"
      defaultActiveFirstOption={false}
      disabled={disabled}
      filterOption={false}
      mode={isSingleSelect ? undefined : 'multiple'}
      notFoundContent={null}
      options={updatedOption}
      placeholder={t('label.select-to-search')}
      showArrow={false}
      value={assignees.length ? assignees : undefined}
      onChange={handleOnChange}
      onSearch={debounce(onSearch, 300)}
      {...rest}
    />
  );
};

export default Assignees;
