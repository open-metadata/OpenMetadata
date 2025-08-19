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
import { Button, Space, Typography } from 'antd';
import { Select, Tooltip } from '../../common/AntdCompat';;
import { AxiosError } from 'axios';
import { debounce } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { EntityType } from '../../../enums/entity.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Paging } from '../../../generated/type/paging';
import { getEntityName } from '../../../utils/EntityUtils';
import { tagRender } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Loader from '../../common/Loader/Loader';
import {
  DataProductSelectOption,
  DataProductsSelectListProps,
} from './DataProductSelectList.interface';

const DataProductsSelectList = ({
  mode,
  onSubmit,
  onCancel,
  fetchOptions,
  debounceTimeout = 800,
  defaultValue,
  ...props
}: DataProductsSelectListProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hasContentLoading, setHasContentLoading] = useState(false);
  const [options, setOptions] = useState<DataProductSelectOption[]>([]);
  const [searchValue, setSearchValue] = useState<string>('');
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedValue, setSelectedValue] = useState<DataProduct[]>([]);
  const { t } = useTranslation();
  const [isSubmitLoading, setIsSubmitLoading] = useState(false);

  const onSave = async () => {
    setIsSubmitLoading(true);
    try {
      await onSubmit?.(selectedValue);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSubmitLoading(false);
    }
  };

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

  const selectOptions = useMemo(() => {
    return options.map((item) => {
      return {
        label: item.label,
        displayName: (
          <Space className="w-full" direction="vertical" size={0}>
            <Typography.Paragraph ellipsis className="text-grey-muted m-0 p-0">
              {item.value.domains
                ?.map((domain) => getEntityName(domain))
                .join(', ')}
            </Typography.Paragraph>
            <Typography.Text ellipsis>
              {getEntityName(item.value)}
            </Typography.Text>
          </Space>
        ),
        value: item.value.fullyQualifiedName,
      };
    });
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
      <Space className="p-sm p-b-xss p-l-xs custom-dropdown-render" size={8}>
        <Button
          className="update-btn"
          data-testid="saveAssociatedTag"
          loading={isSubmitLoading}
          size="small"
          onClick={onSave}>
          {t('label.update')}
        </Button>
        <Button
          data-testid="cancelAssociatedTag"
          size="small"
          onClick={onCancel}>
          {t('label.cancel')}
        </Button>
      </Space>
    </>
  );

  const onSelectChange = (value: string[]) => {
    const entityObj = value.reduce((result: DataProduct[], item) => {
      const option = options.find((option) => option.label === item);
      if (option) {
        result.push(option.value);
      } else {
        result.push({
          fullyQualifiedName: item,
          name: item,
          type: EntityType.DATA_PRODUCT,
        } as unknown as DataProduct);
      }

      return result;
    }, []);

    setSelectedValue(entityObj as DataProduct[]);
  };

  return (
    <Select
      autoFocus
      showSearch
      className="w-full"
      data-testid="data-product-selector"
      defaultValue={defaultValue}
      dropdownRender={dropdownRender}
      filterOption={false}
      mode={mode}
      notFoundContent={isLoading ? <Loader size="small" /> : null}
      optionLabelProp="label"
      tagRender={tagRender}
      onChange={onSelectChange}
      onFocus={() => loadOptions('')}
      onPopupScroll={onScroll}
      onSearch={debounceFetcher}
      {...props}>
      {selectOptions.map(({ label, value, displayName }) => (
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

export default DataProductsSelectList;
