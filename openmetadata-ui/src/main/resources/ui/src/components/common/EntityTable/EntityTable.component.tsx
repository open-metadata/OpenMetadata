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

import {
  Avatar,
  Button,
  Col,
  Modal,
  Popover,
  Row,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/es/table';
import { Key, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DeleteIconColored from '../../../assets/svg/delete-colored.svg';
import { ReactComponent as DropDownIcon } from '../../../assets/svg/drop-down.svg';
import { ReactComponent as GridViewIcon } from '../../../assets/svg/ic-grid-view.svg';
import { ReactComponent as LayersIcon } from '../../../assets/svg/ic-layers-white.svg';
import { ReactComponent as ListViewIcon } from '../../../assets/svg/ic-list-view.svg';
import { ReactComponent as TagIcon } from '../../../assets/svg/ic-tag-gray.svg';
import { ReactComponent as AggregateIcon } from '../../../assets/svg/tags/ic-aggregate.svg';
import { ReactComponent as ConsumerAlignedIcon } from '../../../assets/svg/tags/ic-consumer-aligned.svg';
import { ReactComponent as SourceAlignedIcon } from '../../../assets/svg/tags/ic-source-aligned.svg';
import { SearchIndex } from '../../../enums/search.enum';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getDomainsPath } from '../../../utils/RouterUtils';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import AppBadge from '../Badge/Badge.component';
import FilterTablePlaceHolder from '../ErrorWithPlaceholder/FilterTablePlaceHolder';
import Table from '../Table/Table';
import {
  EntityData,
  EntityListViewOptions,
  EntityTableColumn,
  EntityTableFilters,
  EntityTableProps,
  EntityTableType,
} from './EntityTable.interface';
import GridView from './GridView/GridView.component';
import SearchInput from './SearchInput/SearchInput.component';
import TableFilters from './TableFilters/TableFilters.component';

import './entity-table.less';

const { Title, Text } = Typography;

const SearchLoadingIndicator = ({
  isVisible,
  t,
}: {
  isVisible: boolean;
  t: any;
}) => {
  if (!isVisible) {
    return null;
  }

  return <Text className="search-loading-text">{t('label.searching')}...</Text>;
};

const getRowKeyValue = (record: EntityData, rowKey: string): string => {
  return (record as unknown as Record<string, string>)[rowKey] || '';
};

const EntityTable = ({
  type,
  data = [],
  loading = false,
  total = 0,
  searchTerm = '',
  filters = {
    owners: [],
    glossaryTerms: [],
    domainTypes: [],
    tags: [],
  },
  searchIndex,
  baseQueryFilter,
  onSearchChange,
  onFiltersUpdate,
  onDelete,
  onBulkDelete,
  onRowClick,
  onDomainTypeChange,
  rowKey = 'id',
  showPagination = true,
}: EntityTableProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const effectiveSearchIndex = useMemo(() => {
    if (searchIndex) {
      return searchIndex;
    }

    switch (type) {
      case 'domains':
      case 'sub-domains':
        return SearchIndex.DOMAIN;
      case 'data-products':
        return SearchIndex.DATA_PRODUCT;
      default:
        return SearchIndex.DOMAIN;
    }
  }, [type, searchIndex]);

  const [selectedRows, setSelectedRows] = useState<Key[]>([]);
  const [deleteModal, setDeleteModal] = useState<{
    visible: boolean;
    entity?: EntityData;
  }>({ visible: false });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<{
    recordId: string;
    domainType: string;
  } | null>(null);
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [view, setView] = useState<EntityListViewOptions>(
    EntityListViewOptions.GRID
  );

  // Update local search term when prop changes
  useEffect(() => {
    setLocalSearchTerm(searchTerm);
  }, [searchTerm]);

  const handleFilterChange = useCallback(
    (newFilters: EntityTableFilters) => {
      onFiltersUpdate?.(newFilters);
    },
    [onFiltersUpdate]
  );

  const handleClearAllFilters = useCallback(() => {
    const emptyFilters: EntityTableFilters = {
      owners: [],
      glossaryTerms: [],
      domainTypes: [],
      tags: [],
    };
    onFiltersUpdate?.(emptyFilters);
  }, [onFiltersUpdate]);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setLocalSearchTerm(value);

      if (onSearchChange) {
        onSearchChange(value);
      }
    },
    [onSearchChange]
  );

  const generateEntityIcon = useCallback((record: EntityData) => {
    const style = record.style;

    if (style?.iconURL) {
      return (
        <div className="entity-icon-container">
          <Avatar className="entity-icon" size={40} src={style.iconURL} />
        </div>
      );
    }

    return (
      <div className="entity-icon-container">
        <div className="entity-icon-avatar">
          <LayersIcon className="entity-icon-layers" />
        </div>
      </div>
    );
  }, []);

  const getDomainTypeForDisplay = useCallback(
    (record: EntityData): string => {
      if (type === 'data-products') {
        return 'Data Product';
      }

      const domain = record as Domain;

      return domain.domainType || DomainType.Aggregate;
    },
    [type]
  );

  const getDomainTypeClass = useCallback((domainType: string) => {
    switch (domainType) {
      case 'Aggregate':
        return 'aggregate-domain-type';
      case 'Consumer-aligned':
        return 'consumer-aligned-domain-type';
      case 'Source-aligned':
        return 'source-aligned-domain-type';
      case 'Data Product':
        return 'badge-secondary';
      default:
        return 'badge-secondary';
    }
  }, []);

  const getDomainTypeIcon = useCallback((domainType: string) => {
    switch (domainType) {
      case 'Aggregate':
        return <AggregateIcon />;
      case 'Consumer-aligned':
        return <ConsumerAlignedIcon />;
      case 'Source-aligned':
        return <SourceAlignedIcon />;
      default:
        return null;
    }
  }, []);

  const handlePopoverVisibility = useCallback(
    (recordId: string, domainType: string, visible: boolean) => {
      setIsPopoverVisible(visible);
      if (visible) {
        setSelectedRecord({ recordId, domainType });
      } else {
        setSelectedRecord(null);
      }
    },
    []
  );

  const handleDomainTypeSelection = useCallback(
    (recordId: string, newDomainType: string) => {
      setIsPopoverVisible(false);
      setSelectedRecord(null);
      onDomainTypeChange?.(recordId, newDomainType);
    },
    [onDomainTypeChange]
  );

  const renderDomainTypePopover = useCallback(() => {
    if (!selectedRecord) {
      return null;
    }

    const domainTypes = [
      {
        key: 'Aggregate',
        label: 'Aggregate',
        icon: <AggregateIcon height={16} width={16} />,
      },
      {
        key: 'Consumer-aligned',
        label: 'Consumer-aligned',
        icon: <ConsumerAlignedIcon height={16} width={16} />,
      },
      {
        key: 'Source-aligned',
        label: 'Source-aligned',
        icon: <SourceAlignedIcon height={16} width={16} />,
      },
    ];

    return (
      <div className="entity-type-popover">
        <div className="popover-options">
          {domainTypes.map((domainType) => {
            const isSelected = selectedRecord.domainType === domainType.key;
            const domainTypeClass = getDomainTypeClass(domainType.key);

            return (
              <div
                className={`popover-option ${
                  isSelected ? 'selected' : ''
                } ${domainTypeClass}`}
                key={domainType.key}
                onClick={() =>
                  handleDomainTypeSelection(
                    selectedRecord.recordId,
                    domainType.key
                  )
                }>
                <span className="option-icon">{domainType.icon}</span>
                <span className="option-label">{domainType.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [selectedRecord, t, handleDomainTypeSelection, getDomainTypeClass]);

  const getEntityDisplayName = (entityType: EntityTableType): string => {
    switch (entityType) {
      case 'domains':
        return t('label.domain');
      case 'data-products':
        return t('label.data-product');
      case 'sub-domains':
        return t('label.sub-domain');
      default:
        return t('label.entity');
    }
  };

  const generateColumns = useCallback((): EntityTableColumn[] => {
    const baseColumns: EntityTableColumn[] = [
      {
        key: 'name',
        title: getEntityDisplayName(type),
        dataIndex: 'name',
        render: (value: unknown, record: EntityData) => (
          <div className="entity-name-cell">
            {generateEntityIcon(record)}
            <div className="entity-info">
              <div className="entity-name">
                <span
                  className="entity-name-link"
                  style={{ cursor: 'pointer', color: '#1890ff' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(getDomainsPath(record.fullyQualifiedName));
                  }}>
                  {record.displayName || record.name}
                </span>
              </div>
              <div className="entity-description">
                <RichTextEditorPreviewerV1
                  showReadMoreBtn
                  markdown={record.description || '-'}
                  maxLength={50}
                />
              </div>
            </div>
          </div>
        ),
        width: 300,
      },
      {
        key: 'owner',
        title: t('label.owner'),
        dataIndex: 'owners',
        render: (value: unknown) => {
          const owners = value as EntityReference[];
          if (!owners || owners.length === 0) {
            return <span className="text-grey-muted">-</span>;
          }

          const owner = owners[0];

          return (
            <div className="owner-cell">
              <Avatar
                size={24}
                src={(owner as any).profile?.images?.image512}
              />
              <span className="owner-name">
                {owner.displayName || owner.name}
              </span>
            </div>
          );
        },
        width: 200,
      },
      {
        key: 'glossaryTerms',
        title: t('label.glossary-term-plural'),
        dataIndex: 'tags',
        render: (value: unknown) => {
          const tags = value as TagLabel[];
          const glossaryTerms =
            tags?.filter((tag) => tag.source === 'Glossary') || [];

          if (glossaryTerms.length === 0) {
            return <span className="text-grey-muted">-</span>;
          }

          return glossaryTerms.map((term) => (
            <span
              className="entity-badge badge-secondary mr-1"
              key={term.tagFQN}>
              {term.name || term.tagFQN}
            </span>
          ));
        },
        width: 250,
      },
      {
        key: 'domainType',
        title: t('label.domain-type'),
        dataIndex: 'domainType',
        render: (_, record: EntityData) => {
          const domainType = getDomainTypeForDisplay(record);
          const recordId = getRowKeyValue(record, rowKey);
          const icon = getDomainTypeIcon(domainType);

          return (
            <div className={`entity-badge ${getDomainTypeClass(domainType)}`}>
              <div className="d-flex badge-icon">
                {icon}
                {domainType}
              </div>

              {onDomainTypeChange && (
                <Popover
                  destroyTooltipOnHide
                  content={renderDomainTypePopover()}
                  open={
                    isPopoverVisible && selectedRecord?.recordId === recordId
                  }
                  overlayClassName="entity-type-popover"
                  placement="bottom"
                  trigger="click"
                  onOpenChange={(visible) =>
                    handlePopoverVisibility(recordId, domainType, visible)
                  }>
                  <DropDownIcon
                    className="entity-type-dropdown-icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePopoverVisibility(recordId, domainType, true);
                    }}
                  />
                </Popover>
              )}
            </div>
          );
        },
        width: 150,
      },
      {
        key: 'tags',
        title: t('label.tag'),
        dataIndex: 'tags',
        render: (value: unknown) => {
          const tags = value as TagLabel[];
          const nonGlossaryTags =
            tags?.filter((tag) => tag.source !== 'Glossary') || [];

          if (nonGlossaryTags.length === 0) {
            return <span className="text-grey-muted">-</span>;
          }

          return (
            <div className="table-tags-container">
              {nonGlossaryTags.map((tag, index) => (
                <div
                  className="d-flex align-items-center tags-container"
                  key={`${tag.tagFQN}-${index}`}>
                  <span className="entity-badge tags-badge">
                    <TagIcon className="tag-icon" />
                    <span className="tag-text">{tag.name || tag.tagFQN}</span>
                  </span>
                </div>
              ))}
            </div>
          );
        },
        width: 200,
      },
    ];

    return baseColumns;
  }, [
    type,
    t,
    generateEntityIcon,
    getDomainTypeForDisplay,
    getDomainTypeClass,
    navigate,
    isPopoverVisible,
    handlePopoverVisibility,
    renderDomainTypePopover,
    rowKey,
    getDomainTypeIcon,
    onDomainTypeChange,
  ]);

  const antdColumns: ColumnsType<EntityData> = useMemo(() => {
    const columns = generateColumns();

    const baseColumns = columns.map((column: EntityTableColumn) => {
      return {
        key: column.key,
        title: column.title,
        dataIndex: column.dataIndex || column.key,
        render: column.render,
        sorter: column.sorter,
        width: column.width,
        fixed: column.fixed,
        ellipsis: column.ellipsis,
      };
    });

    return baseColumns;
  }, [generateColumns, selectedRows, data, rowKey]);

  const handleRowClick = useCallback(
    (record: EntityData) => {
      if (onRowClick) {
        onRowClick(record);
      }
    },
    [onRowClick]
  );

  const handleDelete = async (entity: EntityData) => {
    if (!onDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(entity.id);
      setDeleteModal({ visible: false });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!onBulkDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const ids = selectedRows.map((key) => String(key));
      await onBulkDelete(ids);
      setSelectedRows([]);
      setDeleteModal({ visible: false });
    } finally {
      setIsDeleting(false);
    }
  };

  const renderHeader = () => {
    const displayTitle = getEntityDisplayName(type);

    return (
      <div className="entity-table-header">
        <Row className="entity-table-header-row" gutter={[16, 24]}>
          <Col>
            <div className="header-info">
              <Title className="header-title" level={4}>
                {displayTitle}
              </Title>
              <AppBadge
                bgColor="#EFF8FF"
                className="header-count"
                label={total.toString()}
              />
            </div>
          </Col>
          <Col>
            <SearchInput
              placeholder={t('label.search')}
              style={{
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s ease',
              }}
              value={localSearchTerm}
              variant="header"
              onChange={handleSearchChange}
            />
            <SearchLoadingIndicator isVisible={loading} t={t} />
          </Col>
          <Col className="header-filters">
            {/* Filter Section */}
            <TableFilters
              filters={filters}
              options={{
                owners: [],
                glossaryTerms: [],
                domainTypes: [],
                tags: [],
              }}
              queryFilter={baseQueryFilter}
              searchIndex={effectiveSearchIndex}
              onClearAll={handleClearAllFilters}
              onFilterChange={handleFilterChange}
            />
          </Col>
          <Col>
            <Row className="header-actions-row">
              <Col>
                <Button
                  className={`${
                    view === EntityListViewOptions.LIST ? 'active' : ''
                  } list-view-icon`}
                  type="ghost"
                  onClick={() => setView(EntityListViewOptions.LIST)}>
                  <ListViewIcon />
                </Button>
              </Col>
              <Col>
                <Button
                  className={`${
                    view === EntityListViewOptions.GRID ? 'active' : ''
                  } grid-view-icon`}
                  type="ghost"
                  onClick={() => setView(EntityListViewOptions.GRID)}>
                  <GridViewIcon />
                </Button>
              </Col>
              {selectedRows.length > 0 && onDelete && (
                <Col>
                  <Tooltip title={t('label.delete-selected')}>
                    <button
                      className="delete-button"
                      onClick={() => setDeleteModal({ visible: true })}>
                      <img
                        alt={t('label.delete')}
                        height={16}
                        src={DeleteIconColored}
                        width={16}
                      />
                      {`${t('label.delete')} (${selectedRows.length})`}
                    </button>
                  </Tooltip>
                </Col>
              )}
            </Row>
          </Col>
        </Row>
      </div>
    );
  };

  const renderLayoutType = () => {
    switch (view) {
      case EntityListViewOptions.GRID:
        return (
          <GridView<EntityData[]>
            data={data}
            header={renderHeader()}
            loading={loading}
          />
        );

      case EntityListViewOptions.LIST:
        return (
          <Table
            bordered={false}
            columns={antdColumns}
            dataSource={data}
            expandable={{
              expandedRowRender: undefined,
              rowExpandable: () => false,
              showExpandColumn: false,
            }}
            loading={loading}
            locale={{
              emptyText: (
                <FilterTablePlaceHolder
                  placeholderText={t('message.no-entity-found')}
                />
              ),
            }}
            pagination={showPagination ? undefined : false}
            rowKey={rowKey}
            rowSelection={{
              selectedRowKeys: selectedRows,
              onChange: (selectedRowKeys) => {
                setSelectedRows(selectedRowKeys);
              },
            }}
            title={() => renderHeader()}
            onRow={(record) => ({
              onClick: () => handleRowClick(record),
              style: { cursor: onRowClick ? 'pointer' : 'default' },
            })}
          />
        );

      default:
        return (
          <GridView<EntityData[]>
            data={data}
            header={renderHeader()}
            loading={loading}
          />
        );
    }
  };

  return (
    <div className="entity-table" data-testid="entity-table">
      {renderLayoutType()}

      <Modal
        centered
        destroyOnClose
        aria-labelledby="delete-entity-modal-title"
        aria-modal="true"
        closable={false}
        footer={null}
        open={deleteModal.visible}
        title={null}
        onCancel={() => setDeleteModal({ visible: false })}>
        <div className="modal-content">
          <div className="icon-container">
            <img
              alt={t('label.delete')}
              height={32}
              src={DeleteIconColored}
              width={32}
            />
          </div>
          <div className="modal-title" id="delete-entity-modal-title">
            {deleteModal.entity
              ? t('label.delete-entity', {
                  entity:
                    deleteModal.entity.displayName || deleteModal.entity.name,
                })
              : t('label.delete-selected-entities', {
                  count: selectedRows.length,
                  entity: getEntityDisplayName(type),
                })}
          </div>
          <div className="modal-description">
            {deleteModal.entity
              ? t('message.delete-domain-confirmation')
              : t('message.delete-selected-domains-confirmation', {
                  count: selectedRows.length,
                })}
          </div>
          <div className="modal-actions">
            <button
              className="btn btn-secondary"
              disabled={isDeleting}
              onClick={() => setDeleteModal({ visible: false })}>
              {t('label.cancel')}
            </button>
            <button
              className="btn btn-danger"
              data-testid="confirm-delete-btn"
              disabled={isDeleting}
              onClick={() =>
                deleteModal.entity
                  ? handleDelete(deleteModal.entity)
                  : handleBulkDelete()
              }>
              {isDeleting ? t('label.deleting') : t('label.delete')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default EntityTable;
