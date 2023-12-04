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
import { PlusOutlined } from '@ant-design/icons';
import { Button, Divider, Dropdown, Menu, Typography } from 'antd';
import { isEmpty } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchIndex } from '../../enums/search.enum';
import {
  QueryFieldInterface,
  QueryFieldValueInterface,
} from '../../pages/ExplorePage/ExplorePage.interface';
import { getAssetsPageQuickFilters } from '../../utils/AdvancedSearchUtils';
import { getSelectedValuesFromQuickFilter } from '../../utils/Explore.utils';
import { ExploreQuickFilterField } from '../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../Explore/ExploreQuickFilters';
import { AssetFiltersProps } from './AssetFilters.interface';

const AssetFilters = ({
  filterData,
  type,
  aggregations,
  onQuickFilterChange,
  quickFilterQuery,
}: AssetFiltersProps) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ExploreQuickFilterField[]>(
    [] as ExploreQuickFilterField[]
  );
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([] as ExploreQuickFilterField[]);

  const handleMenuClick = ({ key }: { key: string }) => {
    setSelectedFilter((prevSelected) => [...prevSelected, key]);
  };

  const menu = useMemo(
    () => (
      <Menu selectedKeys={selectedFilter} onClick={handleMenuClick}>
        {filters.map((filter) => (
          <Menu.Item key={filter.key}>{filter.label}</Menu.Item>
        ))}
      </Menu>
    ),
    [selectedFilter, filters]
  );

  const handleQuickFiltersChange = (data: ExploreQuickFilterField[]) => {
    const must: QueryFieldInterface[] = [];
    data.forEach((filter) => {
      if (!isEmpty(filter.value)) {
        const should: QueryFieldValueInterface[] = [];
        if (filter.value) {
          filter.value.forEach((filterValue) => {
            const term: Record<string, string> = {};
            term[filter.key] = filterValue.key;
            should.push({ term });
          });
        }

        must.push({
          bool: { should },
        });
      }
    });

    const quickFilterQuery = isEmpty(must)
      ? undefined
      : {
          query: { bool: { must } },
        };

    onQuickFilterChange?.(quickFilterQuery);
  };

  const handleQuickFiltersValueSelect = useCallback(
    (field: ExploreQuickFilterField) => {
      setSelectedQuickFilters((pre) => {
        const data = pre.map((preField) => {
          if (preField.key === field.key) {
            return field;
          } else {
            return preField;
          }
        });

        handleQuickFiltersChange(data);

        return data;
      });
    },
    [setSelectedQuickFilters]
  );

  const clearFilters = useCallback(() => {
    setSelectedQuickFilters((pre) => {
      const data = pre.map((preField) => {
        return { ...preField, value: [] };
      });

      handleQuickFiltersChange(data);

      return data;
    });
  }, [handleQuickFiltersChange, setSelectedQuickFilters]);

  useEffect(() => {
    if (filterData?.length === 0) {
      const dropdownItems = getAssetsPageQuickFilters(type);

      setFilters(
        dropdownItems.map((item) => ({
          ...item,
          value: getSelectedValuesFromQuickFilter(
            item,
            dropdownItems,
            undefined // pass in state variable
          ),
        }))
      );
    } else {
      setFilters(filterData ?? []);
    }
  }, [filterData, type]);

  useEffect(() => {
    const updatedQuickFilters = filters
      .filter((filter) => selectedFilter.includes(filter.key))
      .map((selectedFilterItem) => {
        const originalFilterItem = selectedQuickFilters?.find(
          (filter) => filter.key === selectedFilterItem.key
        );

        return originalFilterItem || selectedFilterItem;
      });

    const newItems = updatedQuickFilters.filter(
      (item) =>
        !selectedQuickFilters.some(
          (existingItem) => item.key === existingItem.key
        )
    );

    if (newItems.length > 0) {
      setSelectedQuickFilters((prevSelected) => [...prevSelected, ...newItems]);
    }
  }, [selectedFilter, selectedQuickFilters, filters]);

  return (
    <>
      <Dropdown overlay={menu} trigger={['click']}>
        <Button icon={<PlusOutlined />} size="small" type="primary" />
      </Dropdown>
      {selectedQuickFilters.length > 0 && (
        <>
          <Divider className="m-x-md h-6" type="vertical" />
          <div className="d-flex justify-between flex-1">
            <ExploreQuickFilters
              aggregations={aggregations}
              fields={selectedQuickFilters}
              index={SearchIndex.ALL}
              onFieldValueSelect={(data) =>
                handleQuickFiltersValueSelect?.(data)
              }
            />
            {quickFilterQuery && (
              <Typography.Text
                className="text-primary self-center cursor-pointer"
                onClick={clearFilters}>
                {t('label.clear-entity', {
                  entity: '',
                })}
              </Typography.Text>
            )}
          </div>
        </>
      )}
    </>
  );
};

export default AssetFilters;
