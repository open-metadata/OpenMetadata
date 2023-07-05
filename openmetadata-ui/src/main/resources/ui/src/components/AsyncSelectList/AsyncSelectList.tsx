/*
 *  Copyright 2023 Collate.
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
import { Select, Space, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import Loader from 'components/Loader/Loader';
import { FQN_SEPARATOR_CHAR } from 'constants/char.constants';
import { Paging } from 'generated/type/paging';
import { debounce } from 'lodash';
import React, { FC, useCallback, useMemo, useState } from 'react';
import { tagRender } from 'utils/TagsUtils';
import { showErrorToast } from 'utils/ToastUtils';
import Fqn from '../../utils/Fqn';
import {
  AsyncSelectListProps,
  SelectOption,
} from './AsyncSelectList.interface';

const AsyncSelectList: FC<AsyncSelectListProps> = ({
  mode,
  onChange,
  fetchOptions,
  debounceTimeout = 800,
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);

  const loadOptions = useCallback(
    async (value: string) => {
      setOptions([]);
      setIsLoading(true);
      try {
        const res = await fetchOptions(value, 1);
        setOptions(res.data);
        setPaging(res.paging);
        setSearchValue(value);
        setCurrentPage(1);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoading(false);
      }
    },
    [fetchOptions]
  );

  const debounceFetcher = useMemo(
    () => debounce(loadOptions, debounceTimeout),
    [loadOptions, debounceTimeout]
  );

  const tagOptions = useMemo(() => {
    const newTags = options
      .filter((tag) => !tag.label?.startsWith(`Tier${FQN_SEPARATOR_CHAR}Tier`)) // To filter out Tier tags
      .map((tag) => {
        const parts = Fqn.split(tag.label);
        const lastPartOfTag = parts.slice(-1).join(FQN_SEPARATOR_CHAR);
        parts.pop();

        return {
          label: tag.label,
          displayName: (
            <Space className="w-full" direction="vertical" size={0}>
              <Typography.Paragraph
                ellipsis
                className="text-grey-muted m-0 p-0">
                {parts.join(FQN_SEPARATOR_CHAR)}
              </Typography.Paragraph>
              <Typography.Text ellipsis>{lastPartOfTag}</Typography.Text>
            </Space>
          ),
          value: tag.value,
        };
      });

    return newTags;
  }, [options]);

  const onScroll = async (e: React.UIEvent<HTMLDivElement>) => {
    const { currentTarget } = e;
    if (
      currentTarget.scrollTop + currentTarget.offsetHeight ===
      currentTarget.scrollHeight
    ) {
      if (options.length < paging.total) {
        try {
          setHasContentLoading(true);
          const res = await fetchOptions(searchValue, currentPage + 1);
          setOptions((prev) => [...prev, ...res.data]);
          setPaging(res.paging);
          setCurrentPage((prev) => prev + 1);
        } catch (error) {
          showErrorToast(error as AxiosError);
        } finally {
          setHasContentLoading(false);
        }
      }
    }
  };

  const dropdownRender = (menu: React.ReactElement) => (
    <>
      {menu}
      {hasContentLoading ? <Loader size="small" /> : null}
    </>
  );

  return (
    <Select
      autoFocus
      showSearch
      data-testid="tag-selector"
      dropdownRender={dropdownRender}
      filterOption={false}
      mode={mode}
      notFoundContent={isLoading ? <Loader size="small" /> : null}
      optionLabelProp="label"
      style={{ width: '100%' }}
      tagRender={tagRender}
      onBlur={() => {
        setCurrentPage(1);
        setSearchValue('');
        setOptions([]);
      }}
      onChange={onChange}
      onFocus={() => loadOptions('')}
      onPopupScroll={onScroll}
      onSearch={debounceFetcher}
      {...props}>
      {tagOptions.map(({ label, value, displayName }) => (
        <Select.Option data-testid={`tag-${value}`} key={label} value={value}>
          <Tooltip
            destroyTooltipOnHide
            mouseEnterDelay={1.5}
            placement="leftTop"
            title={label}
            trigger="hover">
            {displayName}
          </Tooltip>
        </Select.Option>
      ))}
    </Select>
  );
};

export default AsyncSelectList;
