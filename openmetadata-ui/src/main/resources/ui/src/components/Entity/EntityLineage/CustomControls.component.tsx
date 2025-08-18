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
import { Button, Dropdown, Radio, Space, Tooltip } from 'antd';
import { ItemType } from 'antd/lib/menu/hooks/useItems';
import classNames from 'classnames';
import { FC, memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as TableViewIcon } from '../../../assets/svg/ic-column.svg';
import { ReactComponent as DiagramViewIcon } from '../../../assets/svg/ic-platform-lineage.svg';
import { DATA_ASSET_ICON_DIMENSION } from '../../../constants/constants';
import {
  LINEAGE_DEFAULT_QUICK_FILTERS,
  LINEAGE_TAB_VIEW,
} from '../../../constants/Lineage.constants';
import { useLineageProvider } from '../../../context/LineageProvider/LineageProvider';
import { SearchIndex } from '../../../enums/search.enum';
import { getAssetsPageQuickFilters } from '../../../utils/AdvancedSearchUtils';
import { getQuickFilterQuery } from '../../../utils/ExploreUtils';
import { ExploreQuickFilterField } from '../../Explore/ExplorePage.interface';
import ExploreQuickFilters from '../../Explore/ExploreQuickFilters';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { LineageControlProps } from './EntityLineage.interface';
import LineageSearchSelect from './LineageSearchSelect/LineageSearchSelect';

const CustomControls: FC<LineageControlProps> = ({
  onlyShowTabSwitch,
  activeViewTab,
  handleActiveViewTabChange,
}: LineageControlProps) => {
  const { t } = useTranslation();
  const { onQueryFilterUpdate, nodes } = useLineageProvider();
  const [selectedFilter, setSelectedFilter] = useState<string[]>([]);
  const [selectedQuickFilters, setSelectedQuickFilters] = useState<
    ExploreQuickFilterField[]
  >([]);
  const [filters, setFilters] = useState<ExploreQuickFilterField[]>([]);

  const handleMenuClick = ({ key }: { key: string }) => {
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

  const filterMenu: ItemType[] = useMemo(() => {
    return filters.map((filter) => ({
      key: filter.key,
      label: filter.label,
      onClick: handleMenuClick,
    }));
  }, [filters]);

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

  const handleQuickFiltersChange = (data: ExploreQuickFilterField[]) => {
    const quickFilterQuery = getQuickFilterQuery(data);
    onQueryFilterUpdate(JSON.stringify(quickFilterQuery));
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
            <Dropdown
              menu={{
                items: filterMenu,
                selectedKeys: selectedFilter,
              }}
              trigger={['click']}>
              <Button ghost className="expand-btn" type="primary">
                {t('label.advanced')}
                <RightOutlined />
              </Button>
            </Dropdown>
            <ExploreQuickFilters
              independent
              aggregations={{}}
              defaultQueryFilter={queryFilter}
              fields={selectedQuickFilters}
              index={SearchIndex.ALL}
              showDeleted={false}
              onFieldValueSelect={handleQuickFiltersValueSelect}
            />
          </Space>
        </div>
      )}

      <Radio.Group
        className="new-radio-group"
        data-testid="lineage-view-switch"
        optionType="button"
        value={activeViewTab}
        onChange={handleActiveViewTabChange}>
        <Tooltip
          title={t('label.lineage-entity-view', {
            entity: t('label.diagram'),
          })}>
          <Radio.Button value={LINEAGE_TAB_VIEW.DIAGRAM_VIEW}>
            <DiagramViewIcon
              className="align-middle"
              data-testid="lineage-diagram-view-icon"
              style={DATA_ASSET_ICON_DIMENSION}
            />
          </Radio.Button>
        </Tooltip>

        <Tooltip
          title={t('label.lineage-entity-view', {
            entity: t('label.table'),
          })}>
          <Radio.Button value={LINEAGE_TAB_VIEW.TABLE_VIEW}>
            <TableViewIcon
              className="align-middle"
              data-testid="lineage-table-view-icon"
              style={DATA_ASSET_ICON_DIMENSION}
            />
          </Radio.Button>
        </Tooltip>
      </Radio.Group>
    </div>
  );
};

export default memo(CustomControls);
