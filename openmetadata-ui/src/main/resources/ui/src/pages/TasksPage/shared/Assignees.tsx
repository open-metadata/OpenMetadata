/*
 *  Copyright 2021 Collate
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

import { Select, Space, Tag } from 'antd';
import React, { FC } from 'react';
import ProfilePicture from '../../../components/common/ProfilePicture/ProfilePicture';
import { Option } from '../TasksPage.interface';
import './Assignee.less';
import type { CustomTagProps } from 'rc-select/lib/BaseSelect';

interface Props {
  options: Option[];
  assignees: Option[];
  onSearch: (value: string) => void;
  onChange: (values: Option[]) => void;
}

const Assignees: FC<Props> = ({ assignees, onSearch, onChange, options }) => {
  const { Option } = Select;

  const handleOnChange = (_values: Option[], newOptions: Option | Option[]) => {
    const newValues = (newOptions as Option[]).map((option) => ({
      label: option['data-label'],
      value: option.value,
      type: option['data-usertype'],
    }));

    onChange(newValues as Option[]);
  };

  const tagRender = ({
    label,
    closable,
    onClose,
    value,
  }: CustomTagProps): React.ReactElement => {
    return (
      <Tag className="assignee-tag" closable={closable} onClose={onClose}>
        <Space>
          <ProfilePicture
            id={value}
            name={label as unknown as string}
            width="22"
          />
          <span>{label}</span>
        </Space>
      </Tag>
    );
  };

  return (
    <Select
      showSearch
      className="ant-select-custom"
      data-testid="select-assignee"
      defaultActiveFirstOption={false}
      filterOption={false}
      mode="multiple"
      notFoundContent={null}
      placeholder="Search to Select"
      showArrow={false}
      tagRender={tagRender}
      value={assignees.length ? assignees : undefined}
      onChange={handleOnChange}
      onSearch={onSearch}>
      {options.map((option) => (
        <Option
          data-label={option.label}
          data-testid="assignee-option"
          data-usertype={option.type}
          key={option.value}>
          <Space>
            <ProfilePicture id={option.value} name={option.label} width="22" />
            <span>{option.label}</span>
          </Space>
        </Option>
      ))}
    </Select>
  );
};

export default Assignees;
