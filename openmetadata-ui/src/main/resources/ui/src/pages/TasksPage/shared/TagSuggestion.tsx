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

import { Select } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import { isEmpty, isEqual } from 'lodash';
import React, { useState } from 'react';
import { getTagSuggestions } from '../../../axiosAPIs/miscAPI';
import {
  LabelType,
  Source,
  State,
  TagLabel,
} from '../../../generated/type/tagLabel';
import { showErrorToast } from '../../../utils/ToastUtils';

const { Option } = Select;

interface SelectOption {
  label: string;
  value: string;
  'data-sourceType': string;
}

interface Props {
  onChange: (newTags: TagLabel[]) => void;
  selectedTags: TagLabel[];
}

const TagSuggestion: React.FC<Props> = ({ onChange, selectedTags }) => {
  const selectedOptions = React.useMemo(
    () =>
      selectedTags.map((tag) => ({
        label: tag.tagFQN,
        value: tag.tagFQN,
        'data-sourceType': isEqual(tag.source, 'Tag') ? 'tag' : 'glossaryTerm',
      })),
    [selectedTags]
  );

  const [options, setOptions] = useState<SelectOption[]>(selectedOptions);

  const fetchOptions = (query: string) => {
    getTagSuggestions(query)
      .then((res: AxiosResponse) => {
        const suggestOptions =
          res.data.suggest['metadata-suggest'][0].options ?? [];
        const uniqueOptions = [
          ...new Set(
            // eslint-disable-next-line
            suggestOptions.map((op: any) => op._source)
          ),
        ];
        setOptions(
          // eslint-disable-next-line
          uniqueOptions.map((op: any) => ({
            label: op.fullyQualifiedName as string,
            value: op.fullyQualifiedName as string,
            'data-sourceType': op.entityType,
          }))
        );
      })
      .catch((err: AxiosError) => showErrorToast(err));
  };
  const handleSearch = (newValue: string) => {
    if (newValue) {
      fetchOptions(newValue);
    } else {
      setOptions([]);
    }
  };
  const handleOnChange = (
    _values: SelectOption[],
    option: SelectOption | SelectOption[]
  ) => {
    const newTags = (option as SelectOption[]).map((value) => ({
      labelType: LabelType.Manual,
      state: State.Suggested,
      source: isEqual(value['data-sourceType'], 'tag')
        ? Source.Tag
        : Source.Glossary,
      tagFQN: value.value,
    }));
    onChange(newTags);
  };

  return (
    <Select
      showSearch
      className="ant-select-custom"
      data-testid="select-tags"
      defaultActiveFirstOption={false}
      filterOption={false}
      mode="multiple"
      notFoundContent={null}
      placeholder="Search to Select"
      showArrow={false}
      value={!isEmpty(selectedOptions) ? selectedOptions : undefined}
      onChange={handleOnChange}
      onSearch={handleSearch}>
      {options.map((d) => (
        <Option
          data-sourcetype={d['data-sourceType']}
          data-testid="tag-option"
          key={d.value}>
          {d.label}
        </Option>
      ))}
    </Select>
  );
};

export default TagSuggestion;
