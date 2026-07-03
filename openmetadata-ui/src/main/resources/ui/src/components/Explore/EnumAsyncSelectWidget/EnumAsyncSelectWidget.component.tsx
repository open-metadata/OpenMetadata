/*
 *  Copyright 2024 Collate.
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
import { type AsyncFetchListValuesResult, type ListItem } from '@react-awesome-query-builder/antd';
import { Select } from 'antd';
import { debounce } from 'lodash';
import React, { FC, useCallback, useEffect, useRef, useState } from 'react';

interface SelectOption {
  value: string;
  label: string;
}

export interface EnumAsyncSelectWidgetProps {
  asyncFetch: (
    search: string | null,
    offset?: number
  ) => Promise<AsyncFetchListValuesResult>;
  value?: string[];
  setValue: (val: string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

const EnumAsyncSelectWidget: FC<EnumAsyncSelectWidgetProps> = ({
  asyncFetch,
  value,
  setValue,
  multiple,
  placeholder,
  disabled,
}) => {
  const [options, setOptions] = useState<SelectOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const searchRef = useRef('');
  const loadingRef = useRef(false);

  const loadOptions = useCallback(
    async (search: string, offset: number) => {
      if (loadingRef.current) {
        return;
      }
      loadingRef.current = true;
      setLoading(true);
      try {
        const result = await asyncFetch(search || null, offset);
        const mapped = (result.values as ListItem[]).map((o) => ({
          label: String(o.title ?? o.value),
          value: String(o.value),
        }));
        setOptions((prev) => (offset === 0 ? mapped : [...prev, ...mapped]));
        setHasMore(result.hasMore ?? false);
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [asyncFetch]
  );

  useEffect(() => {
    loadOptions('', 0);
  }, [loadOptions]);

  const onSearch = useCallback(
    debounce((text: string) => {
      searchRef.current = text;
      loadOptions(text, 0);
    }, 300),
    [loadOptions]
  );

  const onPopupScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const nearBottom =
        target.scrollHeight - target.scrollTop - target.clientHeight < 20;
      if (nearBottom && hasMore && !loadingRef.current) {
        loadOptions(searchRef.current, options.length);
      }
    },
    [hasMore, options.length, loadOptions]
  );

  return (
    <Select
      disabled={disabled}
      filterOption={false}
      listHeight={256}
      loading={loading}
      mode={multiple ? 'multiple' : undefined}
      options={options}
      placeholder={placeholder}
      showSearch
      value={value}
      virtual
      onChange={setValue}
      onPopupScroll={onPopupScroll}
      onSearch={onSearch}
    />
  );
};

export default EnumAsyncSelectWidget;
