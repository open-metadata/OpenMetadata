/*
 *  Copyright 2025 Collate.
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
import { DownOutlined } from '@ant-design/icons';
import { Button, Checkbox, Popover, Space, Tag } from 'antd';
import { startCase } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import EntitySearchInput from './EntitySearchInput.component';
import './EntityTableFilter.less';

/**
 * Filter option interface for each filter type.
 */
export interface EntityTableFilterOption {
  key: string;
  label: string;
  count?: number;
}

/**
 * Props for EntityTableFilter component.
 */
export interface EntityTableFilterProps {
  filters: {
    owners: string[];
    glossaryTerms: string[];
    domainTypes: string[];
    tags: string[];
  };
  options: {
    owners: EntityTableFilterOption[];
    glossaryTerms: EntityTableFilterOption[];
    domainTypes: EntityTableFilterOption[];
    tags: EntityTableFilterOption[];
  };
  onFilterChange: (filters: EntityTableFilterProps['filters']) => void;
  onClearAll: () => void;
}

const FILTER_KEYS = [
  { key: 'owners', label: 'Owner' },
  { key: 'glossaryTerms', label: 'Glossary Term' },
  { key: 'domainTypes', label: 'Domain Type' },
  { key: 'tags', label: 'Tags' },
] as const;

type FilterKey = typeof FILTER_KEYS[number]['key'];

/**
 * EntityTableFilter component for advanced table filtering UI.
 * @param filters - Current applied filters
 * @param options - Available options for each filter
 * @param onFilterChange - Callback when filters are updated
 * @param onClearAll - Callback to clear all filters
 */
export const EntityTableFilter = ({
  filters,
  options,
  onFilterChange,
  onClearAll,
}: EntityTableFilterProps) => {
  const { t } = useTranslation();
  const [openPopover, setOpenPopover] = useState<FilterKey | null>(null);
  const [searchText, setSearchText] = useState<Record<FilterKey, string>>({
    owners: '',
    glossaryTerms: '',
    domainTypes: '',
    tags: '',
  });
  const [localSelected, setLocalSelected] =
    useState<EntityTableFilterProps['filters']>(filters);

  // Memoized filtered options per filter
  const filteredOptions = useMemo(() => {
    const filter = (arr: EntityTableFilterOption[], text: string) =>
      !text
        ? arr
        : arr.filter((opt) =>
            opt.label.toLowerCase().includes(text.toLowerCase())
          );

    return {
      owners: filter(options.owners, searchText.owners),
      glossaryTerms: filter(options.glossaryTerms, searchText.glossaryTerms),
      domainTypes: filter(options.domainTypes, searchText.domainTypes),
      tags: filter(options.tags, searchText.tags),
    };
  }, [options, searchText]);

  // Open popover for a filter
  const handleOpen = (key: FilterKey) => {
    setOpenPopover(key);
    setLocalSelected(filters);
  };
  // Close popover
  const handleClose = () => setOpenPopover(null);

  // Handle checkbox change in popover
  const handleCheck = (key: FilterKey, value: string, checked: boolean) => {
    setLocalSelected((prev) => ({
      ...prev,
      [key]: checked
        ? [...prev[key], value]
        : prev[key].filter((v) => v !== value),
    }));
  };

  // Handle search input in popover
  const handleSearch = (key: FilterKey, value: string) => {
    setSearchText((prev) => ({ ...prev, [key]: value }));
  };

  // Apply filter changes
  const handleUpdate = () => {
    onFilterChange(localSelected);
    handleClose();
  };

  // Remove a filter group
  const handleRemoveFilter = (key: FilterKey) => {
    onFilterChange({ ...filters, [key]: [] });
  };

  // Remove a single value from a filter group
  const handleRemoveValue = (key: FilterKey, value: string) => {
    onFilterChange({
      ...filters,
      [key]: filters[key].filter((v) => v !== value),
    });
  };

  const noFilterLabel = (key: FilterKey) => `No ${startCase(key)}`;

  // Render popover content for a filter
  const renderPopover = (key: FilterKey) => (
    <div className="etf-popover">
      <EntitySearchInput
        placeholder={`Search ${FILTER_KEYS.find((f) => f.key === key)?.label}`}
        value={searchText[key]}
        onChange={(e) => handleSearch(key, e.target.value)}
      />
      <div className="etf-options-list">
        <div className="etf-option-row no-filter-row">
          <div className="etf-option-checkbox">
            <Checkbox
            // checked={localSelected[key].includes(opt.key)}
            // onChange={(e) => handleCheck(key, opt.key, e.target.checked)}
            />
            <span className="etf-option-label">{noFilterLabel(key)}</span>
          </div>
        </div>
        {filteredOptions[key].map((opt) => (
          <div className="etf-option-row" key={opt.key}>
            <div className="etf-option-checkbox">
              <Checkbox
                checked={localSelected[key].includes(opt.key)}
                onChange={(e) => handleCheck(key, opt.key, e.target.checked)}
              />
              <span className="etf-option-label">{opt.label}</span>
            </div>
            {typeof opt.count === 'number' && (
              <span className="etf-option-count">{opt.count}</span>
            )}
          </div>
        ))}
      </div>
      <Space className="etf-action-buttons" style={{ marginTop: 16 }}>
        <Button size="small" type="ghost" onClick={handleUpdate}>
          {t('label.update')}
        </Button>
        <Button size="small" onClick={handleClose}>
          {t('label.close')}
        </Button>
      </Space>
    </div>
  );

  // Render filter pills below header
  const renderFilterPills = () => (
    <div className="etf-pills-row">
      {FILTER_KEYS.map(
        ({ key, label }) =>
          filters[key].length > 0 && (
            <Tag
              closable
              className="etf-pill"
              key={key}
              onClose={() => handleRemoveFilter(key)}>
              <span className="etf-pill-label">{label}:</span>{' '}
              <span className="etf-pill-values">{filters[key].join(', ')}</span>
            </Tag>
          )
      )}
    </div>
  );

  // Render filter buttons in header
  const renderFilterButtons = () => (
    <Space className="etf-header-filters" size={16}>
      {FILTER_KEYS.map(({ key, label }) => (
        <Popover
          content={renderPopover(key)}
          key={key}
          open={openPopover === key}
          overlayClassName="entity-table-filter-popover"
          placement="bottomLeft"
          trigger="click"
          onOpenChange={(visible) =>
            visible ? handleOpen(key) : handleClose()
          }>
          <Button className="etf-filter-btn" size="small">
            <span className="etf-filter-label">{label}</span>
            {filters[key].length > 0 && (
              <span className="etf-filter-count">({filters[key].length})</span>
            )}
            <DownOutlined style={{ fontSize: 12, marginLeft: 4 }} />
          </Button>
        </Popover>
      ))}
    </Space>
  );

  const anyFilterApplied = FILTER_KEYS.some(
    ({ key }) => filters[key].length > 0
  );

  return (
    <div className="entity-table-filter">
      <div className="etf-header-row">
        {renderFilterButtons()}
        {anyFilterApplied && (
          <Button className="etf-clear-all" type="link" onClick={onClearAll}>
            {t('label.clear-entity', {
              entity: t('label.all'),
            })}
          </Button>
        )}
      </div>
      {renderFilterPills()}
    </div>
  );
};

export default EntityTableFilter;
