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

interface Props {
  index: string;
  field: string;
  onFieldRemove: (value: string) => void;
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
}

const SearchInput = ({
  options,
  value,
  handleChange,
  handleSearch,
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
      className="ant-text-primary"
      defaultActiveFirstOption={false}
      filterOption={false}
      placeholder="Search to Select"
      showArrow={false}
      value={value}
      onChange={handleChange}
      onSearch={handleSearch}>
      {optionsElement}
    </Select>
  );
};

const AdvancedField: FC<Props> = ({ field, onFieldRemove, index }) => {
  const advancedField = getAdvancedField(field);

  const [options, setOptions] = useState<Option[]>([]);
  const [value, setValue] = useState<string>();

  const fetchOptions = (query: string) => {
    if (!MISC_FIELDS.includes(field)) {
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

  return (
    <div className="tw-bg-white tw-border tw-border-main tw-rounded tw-p-1 tw-flex tw-justify-between">
      <span className="tw-self-center">{startCase(getItemLabel(field))}:</span>
      <SearchInput
        handleChange={handleChange}
        handleSearch={handleSearch}
        options={options}
        value={value}
      />
      <span
        className="tw-cursor-pointer tw-self-center"
        onClick={() => onFieldRemove(field)}>
        <FontAwesomeIcon className="tw-text-primary" icon="times" />
      </span>
    </div>
  );
};

export default AdvancedField;
