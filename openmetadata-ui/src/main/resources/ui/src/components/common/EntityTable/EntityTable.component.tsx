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
  Checkbox,
  Col,
  Modal,
  Popover,
  Row,
  Tooltip,
  Typography,
} from 'antd';
import { ColumnsType } from 'antd/es/table';
import { ReactNode, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DeleteIconColored from '../../../assets/svg/delete-colored.svg';
import { ReactComponent as DropDownIcon } from '../../../assets/svg/drop-down.svg';
import { ReactComponent as GridViewIcon } from '../../../assets/svg/ic-grid-view.svg';
import { ReactComponent as LayersIcon } from '../../../assets/svg/ic-layers-white.svg';
import { ReactComponent as ListViewIcon } from '../../../assets/svg/ic-list-layout.svg';
import { ReactComponent as TagIcon } from '../../../assets/svg/ic-tag-gray.svg';
import { ReactComponent as AggregateIcon } from '../../../assets/svg/tags/ic-aggregate.svg';
import { ReactComponent as ConsumerAlignedIcon } from '../../../assets/svg/tags/ic-consumer-aligned.svg';
import { ReactComponent as SourceAlignedIcon } from '../../../assets/svg/tags/ic-source-aligned.svg';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { Domain, DomainType } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getDomainsPath } from '../../../utils/RouterUtils';
import RichTextEditorPreviewerV1 from '../../common/RichTextEditor/RichTextEditorPreviewerV1';
import AppBadge from '../Badge/Badge.component';
import Table from '../Table/Table';
import EntitySearchInput from './EntitySearchInput.component';
import './EntityTable.less';
import {
  EntityTableFilter,
  EntityTableFilterOption,
} from './EntityTableFilter.component';

const { Title, Text } = Typography;

// Entity type discriminator
export type EntityTableType = 'domains' | 'data-products' | 'sub-domains';

// Union type for all supported entity data
export type EntityData = Domain | DataProduct;

// Helper function to safely access rowKey property
const getRowKeyValue = (record: EntityData, rowKey: string): string => {
  return (record as unknown as Record<string, string>)[rowKey] || '';
};

export interface EntityTableColumn {
  key: string;
  title: string | ReactNode;
  dataIndex?: string;
  render?: (value: unknown, record: EntityData) => ReactNode;
  sorter?: boolean | ((a: EntityData, b: EntityData) => number);
  width?: number;
  fixed?: 'left' | 'right';
  ellipsis?: boolean;
}

export interface EntityTableProps {
  // Main props - only these are required
  type: EntityTableType;
  data: EntityData[];

  // Optional callbacks for actions
  onDelete?: (id: string) => Promise<void>;
  onBulkDelete?: (ids: string[]) => Promise<void>;
  onRowClick?: (record: EntityData) => void;
  onDomainTypeChange?: (recordId: string, newDomainType: string) => void;

  // Optional table configuration
  loading?: boolean;
  rowKey?: string;
  [key: string]: unknown;
}

const EntityTable = ({
  type,
  data,
  onDelete,
  onBulkDelete,
  onRowClick,
  onDomainTypeChange,
  loading = false,
  rowKey = 'id',
  ...rest
}: EntityTableProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Internal state for all table functionality
  const [selectedRows, setSelectedRows] = useState<EntityData[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  // Replace individual filter states with a single filters state
  const [filters, setFilters] = useState({
    owners: [],
    glossaryTerms: [],
    domainTypes: [],
    tags: [],
  });
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

  // Update filteredData to use filters state
  const filteredData = useMemo(() => {
    return data.filter((entity) => {
      // Search term filter
      const searchMatch =
        !searchTerm ||
        entity.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entity.description?.toLowerCase().includes(searchTerm.toLowerCase());

      // Owners filter
      const ownerNames = (entity.owners || [])
        .map((owner: EntityReference) => owner.name)
        .filter(Boolean) as string[];
      const ownerMatch =
        filters.owners.length === 0 ||
        filters.owners.some((opt) => ownerNames.includes(opt));

      // Glossary Terms filter
      const glossaryTerms = (entity.tags || [])
        .filter((tag: TagLabel) => tag.source === 'Glossary')
        .map((tag: TagLabel) => tag.tagFQN);
      const glossaryMatch =
        filters.glossaryTerms.length === 0 ||
        filters.glossaryTerms.some((opt) => glossaryTerms.includes(opt));

      // Domain Type filter
      const domainType = String((entity as Domain).domainType);
      const domainTypeMatch =
        filters.domainTypes.length === 0 ||
        filters.domainTypes.includes(domainType);

      // Tags filter
      const tags = (entity.tags || [])
        .filter((tag: TagLabel) => tag.source !== 'Glossary')
        .map((tag: TagLabel) => tag.tagFQN);
      const tagMatch =
        filters.tags.length === 0 ||
        filters.tags.some((opt) => tags.includes(opt));

      return (
        searchMatch &&
        ownerMatch &&
        glossaryMatch &&
        domainTypeMatch &&
        tagMatch
      );
    });
  }, [data, searchTerm, filters]);

  // Generate filter options with counts
  const filterOptions = useMemo(() => {
    const countMap = (arr: string[]) =>
      arr.reduce((acc, key) => {
        acc[key] = (acc[key] || 0) + 1;

        return acc;
      }, {} as Record<string, number>);

    // Owners
    const allOwners = data.flatMap((entity) =>
      (entity.owners || [])
        .map((owner: EntityReference) => owner.name)
        .filter((name): name is string => Boolean(name))
    );
    const ownerCounts = countMap(allOwners);
    const ownerOptions: EntityTableFilterOption[] = Array.from(
      new Set(allOwners)
    ).map((name) => ({
      key: name,
      label: name,
      count: ownerCounts[name],
    }));

    // Glossary Terms
    const allGlossary = data.flatMap((entity) =>
      (entity.tags || [])
        .filter((tag: TagLabel) => tag.source === 'Glossary')
        .map((tag: TagLabel) => tag.tagFQN)
        .filter((name) => Boolean(name))
    );
    const glossaryCounts = countMap(allGlossary);
    const glossaryOptions: EntityTableFilterOption[] = Array.from(
      new Set(allGlossary)
    ).map((name) => ({
      key: name,
      label: name,
      count: glossaryCounts[name],
    }));

    // Domain Types
    const allDomainTypes = data
      .map((entity) => String((entity as Domain).domainType))
      .filter(Boolean);
    const domainTypeCounts = countMap(allDomainTypes);
    const domainTypeOptions: EntityTableFilterOption[] = Array.from(
      new Set(allDomainTypes)
    ).map((type) => ({
      key: type,
      label: type,
      count: domainTypeCounts[type],
    }));

    // Tags
    const allTags = data.flatMap((entity) =>
      (entity.tags || [])
        .filter((tag: TagLabel) => tag.source !== 'Glossary')
        .map((tag: TagLabel) => tag.tagFQN)
        .filter((tag) => Boolean(tag))
    );
    const tagCounts = countMap(allTags);
    const tagOptions: EntityTableFilterOption[] = Array.from(
      new Set(allTags)
    ).map((tagFQN) => ({
      key: tagFQN,
      label: tagFQN,
      count: tagCounts[tagFQN],
    }));

    return {
      owners: ownerOptions,
      glossaryTerms: glossaryOptions,
      domainTypes: domainTypeOptions,
      tags: tagOptions,
    };
  }, [data]);

  // Generate dynamic entity icon based on style property or default
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

  // Get domain type for display
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

  // Get domain type CSS class
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

  // Get domain type icon
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

  // Handle popover visibility
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

  // Handle domain type selection from popover
  const handleDomainTypeSelection = useCallback(
    (recordId: string, newDomainType: string) => {
      // Close the popover
      setIsPopoverVisible(false);
      setSelectedRecord(null);

      // Call the callback to handle the actual domain type change
      onDomainTypeChange?.(recordId, newDomainType);
    },
    [onDomainTypeChange]
  );

  // Render popover content for domain type selection
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

  // Get entity display name for header
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

  // Generate columns based on entity type
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

              <Popover
                destroyTooltipOnHide
                content={renderDomainTypePopover()}
                open={isPopoverVisible && selectedRecord?.recordId === recordId}
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
            </div>
          );
        },
        width: 200,
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

          return nonGlossaryTags.map((tag, index) => (
            <div
              className="d-flex align-items-center tags-container"
              key={`${tag.tagFQN}-${index}`}>
              <span className="entity-badge tags-badge">
                <TagIcon className="tag-icon" />
                <span className="tag-text">{tag.name || tag.tagFQN}</span>
              </span>
            </div>
          ));
        },
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
  ]);

  // Convert EntityTableColumn to Ant Design ColumnsType
  const antdColumns: ColumnsType<EntityData> = useMemo(() => {
    const columns = generateColumns();

    const baseColumns = columns.map(
      (column: EntityTableColumn, index: number) => {
        // For the first column, add checkbox functionality
        if (index === 0) {
          return {
            key: column.key,
            title: (
              <div className="first-column-header">
                <Checkbox
                  checked={
                    selectedRows.length === filteredData.length &&
                    filteredData.length > 0
                  }
                  className="entity-table-checkbox"
                  indeterminate={
                    selectedRows.length > 0 &&
                    selectedRows.length < filteredData.length
                  }
                  onChange={(e) => {
                    const newSelectedRows = e.target.checked
                      ? filteredData
                      : [];
                    setSelectedRows(newSelectedRows);
                  }}
                />
                <span className="column-title">
                  {typeof column.title === 'string' ? column.title : ''}
                </span>
              </div>
            ),
            dataIndex: column.dataIndex || column.key,
            render: (value: unknown, record: EntityData) => (
              <div className="first-column-content">
                <Checkbox
                  checked={selectedRows.some(
                    (row: EntityData) =>
                      getRowKeyValue(row, rowKey) ===
                      getRowKeyValue(record, rowKey)
                  )}
                  className="entity-table-checkbox"
                  data-testid={`${
                    record.name || getRowKeyValue(record, rowKey)
                  }-checkbox`}
                  onChange={(e) => handleRowSelection(record, e.target.checked)}
                />
                <div className="column-content">
                  {column.render
                    ? column.render(value, record)
                    : String(value || '')}
                </div>
              </div>
            ),
            sorter: column.sorter,
            width: column.width,
            fixed: column.fixed,
            ellipsis: column.ellipsis,
          };
        }

        // For other columns, return as normal
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
      }
    );

    return baseColumns;
  }, [generateColumns, selectedRows, filteredData, rowKey]);

  // Handle individual row selection
  const handleRowSelection = useCallback(
    (record: EntityData, checked: boolean) => {
      const newSelectedRows = checked
        ? [...selectedRows, record]
        : selectedRows.filter(
            (row: EntityData) =>
              getRowKeyValue(row, rowKey) !== getRowKeyValue(record, rowKey)
          );

      setSelectedRows(newSelectedRows);
    },
    [selectedRows, rowKey]
  );

  // Handle row click
  const handleRowClick = useCallback(
    (record: EntityData) => {
      if (onRowClick) {
        onRowClick(record);
      }
    },
    [onRowClick]
  );

  // Handle delete functionality
  const handleDelete = async (entity: EntityData) => {
    if (!onDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      await onDelete(entity.id);
      setSelectedRows(selectedRows.filter((row) => row.id !== entity.id));
      setDeleteModal({ visible: false });
    } catch (error) {
      // Error handling should be done by parent component
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!onBulkDelete) {
      return;
    }

    setIsDeleting(true);
    try {
      const ids = selectedRows.map((row) => row.id);
      await onBulkDelete(ids);
      setSelectedRows([]);
      setDeleteModal({ visible: false });
    } catch (error) {
      // Error handling should be done by parent component
    } finally {
      setIsDeleting(false);
    }
  };

  // Handler for filter changes
  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters);
  };

  const handleClearAll = () => {
    setFilters({ owners: [], glossaryTerms: [], domainTypes: [], tags: [] });
  };

  // Render table header with all controls
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
                label={filteredData.length.toString()}
              />
            </div>
          </Col>
          <Col>
            <EntitySearchInput
              placeholder={t('label.search')}
              value={searchTerm}
              variant="header"
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </Col>
          <Col className="header-actions">
            <EntityTableFilter
              filters={filters}
              options={filterOptions}
              onClearAll={handleClearAll}
              onFilterChange={handleFilterChange}
            />
          </Col>
          <Col>
            <Row>
              <Col>
                <ListViewIcon />
              </Col>
              <Col>
                <GridViewIcon />
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

  return (
    <div className="entity-table">
      <Table
        {...rest}
        resizableColumns
        columns={antdColumns}
        dataSource={filteredData}
        entityType={type}
        expandable={{ expandIcon: () => null }}
        loading={loading}
        pagination={false}
        rowKey={rowKey}
        title={() => renderHeader()}
        onRow={(record) => ({
          onClick: () => handleRowClick(record),
          style: { cursor: onRowClick ? 'pointer' : 'default' },
        })}
      />

      {/* Delete Modal */}
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
