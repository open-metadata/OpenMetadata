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

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Select } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import { startCase } from 'lodash';
import React, { FC, useState } from 'react';
import {
  getAdvancedFieldOptions,
  getUserSuggestions,
} from '../../axiosAPIs/miscAPI';
import { MISC_FIELDS } from '../../constants/advanceSearch.constants';
import {
  getAdvancedField,
  getItemLabel,
} from '../../utils/AdvancedSearchUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { AdvanceField } from '../Explore/explore.interface';

interface Props {
  index: string;
  field: AdvanceField;
  onFieldRemove: (value: string) => void;
  onFieldValueSelect: (field: AdvanceField) => void;
}

interface Option {
  label: string;
  value: string;
}

interface InputProps {
  options: Option[];
  value: string | undefined;
  handleChange: (value: string) => void;
  handleSearch: (value: string) => void;
  handleSelect: (value: string) => void;
  handleClear: () => void;
}

const SearchInput = ({
  options,
  value,
  handleChange,
  handleSearch,
  handleSelect,
  handleClear,
}: InputProps) => {
  const { Option } = Select;

  const optionsElement = options.map((d) => (
    <Option key={d.value}>{d.label}</Option>
  ));

  return (
    <Select
      allowClear
      showSearch
      bordered={false}
      className="ant-advaced-field-select"
      defaultActiveFirstOption={false}
      dropdownClassName="ant-suggestion-dropdown"
      filterOption={false}
      placeholder="Search to Select"
      showArrow={false}
      value={value}
      onChange={handleChange}
      onClear={handleClear}
      onSearch={handleSearch}
      onSelect={handleSelect}>
      {optionsElement}
    </Select>
  );
};

const AdvancedField: FC<Props> = ({
  field,
  onFieldRemove,
  index,
  onFieldValueSelect,
}) => {
  const advancedField = getAdvancedField(field.key);

  const [options, setOptions] = useState<Option[]>([]);
  const [value, setValue] = useState<string | undefined>(field.value);

  const fetchOptions = (query: string) => {
    if (!MISC_FIELDS.includes(field.key)) {
      getAdvancedFieldOptions(query, index, advancedField)
        .then((res: AxiosResponse) => {
          const suggestOptions =
            res.data.suggest['metadata-suggest'][0].options ?? [];
          const uniqueOptions = [
            // eslint-disable-next-line
            ...new Set(suggestOptions.map((op: any) => op.text)),
          ];
          setOptions(
            uniqueOptions.map((op: unknown) => ({
              label: op as string,
              value: op as string,
            }))
          );
        })
        .catch((err: AxiosError) => showErrorToast(err));
    } else {
      getUserSuggestions(query)
        .then((res: AxiosResponse) => {
          const suggestOptions =
            res.data.suggest['metadata-suggest'][0].options ?? [];
          const uniqueOptions = [
            // eslint-disable-next-line
            ...new Set(suggestOptions.map((op: any) => op._source.name)),
          ];
          setOptions(
            uniqueOptions.map((op: unknown) => ({
              label: op as string,
              value: op as string,
            }))
          );
        })
        .catch((err: AxiosError) => showErrorToast(err));
    }
  };

  const handleSearch = (newValue: string) => {
    if (newValue) {
      fetchOptions(newValue);
    } else {
      setOptions([]);
    }
  };

  const handleChange = (newValue: string) => {
    setValue(newValue);
  };

  const handleOnSelect = (value: string) => {
    onFieldValueSelect({ ...field, value });
  };

  const handleOnClear = () => {
    onFieldValueSelect({ ...field, value: undefined });
  };

  return (
    <div className="tw-bg-white tw-border tw-border-main tw-rounded tw-p-1 tw-flex tw-justify-between">
      <span className="tw-self-center">
        {startCase(getItemLabel(field.key))}:
      </span>
      <SearchInput
        handleChange={handleChange}
        handleClear={handleOnClear}
        handleSearch={handleSearch}
        handleSelect={handleOnSelect}
        options={options}
        value={value}
      />
      <span
        className="tw-cursor-pointer tw-self-center"
        onClick={() => onFieldRemove(field.key)}>
        <FontAwesomeIcon className="tw-text-primary" icon="times" />
      </span>
    </div>
  );
};

export default AdvancedField;
