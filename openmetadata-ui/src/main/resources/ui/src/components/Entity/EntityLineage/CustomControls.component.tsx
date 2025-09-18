/* eslint-disable i18next/no-literal-string */
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

import { RightOutlined } from '@ant-design/icons';
import { Button, Menu, MenuItem } from '@mui/material';
import { Space } from 'antd';
import classNames from 'classnames';
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { LINEAGE_DEFAULT_QUICK_FILTERS } from '../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { SearchIndex } from '../../../enums/search.enum';
import { getAssetsPageQuickFilters } from '../../../utils/AdvancedSearchUtils';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { LineageControlProps } from './EntityLineage.interface';
import LineageSearchSelect from './LineageSearchSelect/LineageSearchSelect';

const CustomControls: FC<LineageControlProps> = ({
  onlyShowTabSwitch,
}: LineageControlProps) => {
  const { t } = useTranslation();
  const { setSelectedQuickFilters, nodes, selectedQuickFilters } =
    useLineageProvider();
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const [advanceEl, setAdvanceEl] = useState<null | HTMLElement>(null);

  const [filters, setFilters] = useState<ExploreQuickFilterField[]>([]);
  const navigate = useNavigate();

  const handleMenuClick = (key: string) => {
    setSelectedFilter((prevSelected) => [...prevSelected, key]);
  };

  const queryFilter = useMemo(() => {
    const nodeIds = (nodes ?? [])
      .map((node) => node.data?.node?.id)
      .filter(Boolean);

    return {
      query: {
        bool: {
          must: {
            terms: {
              'id.keyword': nodeIds,
            },
          },
        },
      },
    };
  }, [nodes]);

  useEffect(() => {
    const dropdownItems = getAssetsPageQuickFilters(AssetsOfEntity.LINEAGE);

    setFilters(
      dropdownItems.map((item) => ({
        ...item,
        value: [],
      }))
    );

    const defaultFilterValues = dropdownItems
      .filter((item) => LINEAGE_DEFAULT_QUICK_FILTERS.includes(item.key))
      .map((item) => item.key);

    setSelectedFilter(defaultFilterValues);
  }, []);

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

        return data;
      });
    },
    [setSelectedQuickFilters]
  );

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
    <div
      className={classNames(
        'd-flex w-full',
        onlyShowTabSwitch ? 'justify-end' : 'justify-between'
      )}>
      {!onlyShowTabSwitch && (
        <div className="d-flex items-center gap-4">
          <LineageSearchSelect />
          <Space className="m-l-xs" size={16}>
            <Button
              className="expand-btn"
              variant="outlined"
              onClick={(e) => setAdvanceEl(e.currentTarget)}>
              {t('label.advanced')}
              <RightOutlined />
            </Button>
            <Menu
              anchorEl={advanceEl}
              open={Boolean(advanceEl)}
              onClose={() => setAdvanceEl(null)}>
              {filters.map((item) => (
                <MenuItem
                  key={item.key}
                  selected={selectedFilter.includes(item.key)}
                  sx={{
                    '&.Mui-selected': {
                      color: 'var(--ant-primary-color)',
                      backgroundColor: 'var(--ant-primary-1)',
                    },
                    '&.Mui-selected:hover': {
                      backgroundColor: 'var(--ant-primary-1)',
                    },
                    '&.MuiMenuItem-root': {
                      margin: '0',
                      padding: '4px 12px',
                      borderRadius: '0px',
                    },
                  }}
                  value={item.key}
                  onClick={() => handleMenuClick(item.key)}>
                  {item.label}
                </MenuItem>
              ))}
            </Menu>

            <ExploreQuickFilters
              independent
              aggregations={{}}
              defaultQueryFilter={queryFilter}
              fields={selectedQuickFilters ?? []}
              index={SearchIndex.ALL}
              showDeleted={false}
              onFieldValueSelect={handleQuickFiltersValueSelect}
            />
          </Space>
        </div>
      )}
      <div className="d-flex gap-4 items-center">
        <Button className="font-semibold" variant="contained">
          {t('label.lineage')}
        </Button>
        <Button
          className="font-semibold"
          variant="outlined"
          onClick={() => navigate({ search: '?mode=impact_analysis' })}>
          {t('label.impact-analysis')}
        </Button>
      </div>
    </div>
  );
};

export default memo(CustomControls);
