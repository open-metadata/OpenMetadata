/*
 *  Copyright 2026 Collate.
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
import { Badge, Button, ButtonUtility } from '@openmetadata/ui-core-components';
import { Plus, Trash01 } from '@untitledui/icons';
import { isEmpty } from 'lodash';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { ReactComponent as IconEdit } from '../../assets/svg/edit-new.svg';
import { ReactComponent as StoryLaneIcon } from '../../assets/svg/ic_storylane.svg';
import { ReactComponent as VideoIcon } from '../../assets/svg/ic_video.svg';

import { DeleteModalMUI } from '../../components/common/DeleteModal/DeleteModalMUI';
import Loader from '../../components/common/Loader/Loader';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';

import { useTranslation } from 'react-i18next';
import { useSearch } from '../../components/common/atoms/navigation/useSearch';
import { useViewToggle } from '../../components/common/atoms/navigation/useViewToggle';

import {
  PAGE_SIZE_BASE,
  PAGE_SIZE_LARGE,
  PAGE_SIZE_MEDIUM,
} from '../../constants/constants';

import { LEARNING_CATEGORIES } from '../../components/Learning/Learning.interface';
import {
  MAX_VISIBLE_CONTEXTS,
  MAX_VISIBLE_TAGS,
  PAGE_IDS,
} from '../../constants/Learning.constants';

import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { getSettingPath } from '../../utils/RouterUtils';

import { LearningResource } from '../../rest/learningResourceAPI';
import { useLearningResourceActions } from './hooks/useLearningResourceActions';
import {
  LearningResourceFilterState,
  useLearningResourceFilters,
} from './hooks/useLearningResourceFilters';
import { useLearningResources } from './hooks/useLearningResources';

import { BadgeColors } from '@openmetadata/ui-core-components/dist/types/src/components/base/badges/badge-types';
import { LearningResourceCard } from '../../components/Learning/LearningResourceCard/LearningResourceCard.component';
import { ResourcePlayerModal } from '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component';
import { LearningResourceForm } from './LearningResourceForm.component';

const CATEGORY_BADGE_COLORS: Record<string, BadgeColors> = {
  Discovery: 'blue',
  Administration: 'blue-light',
  DataGovernance: 'indigo',
  DataQuality: 'orange',
  Observability: 'orange',
  AI: 'purple',
};

const getResourceTypeIcon = (type: string) => {
  const icons: Record<
    string,
    React.FunctionComponent<React.SVGProps<SVGSVGElement>>
  > = {
    Video: VideoIcon,
    Storylane: StoryLaneIcon,
  };

  const Icon = icons[type] ?? VideoIcon;

  return (
    <div
      className="d-flex items-center justify-center"
      style={{ width: 32, height: 32, borderRadius: 4, flexShrink: 0 }}>
      <Icon height={24} width={24} />
    </div>
  );
};

const ResourceRow = ({
  record,
  handlePreview,
  handleEdit,
  handleDelete,
}: {
  record: LearningResource;
  handlePreview: (record: LearningResource) => void;
  handleEdit: (record: LearningResource) => void;
  handleDelete: (record: LearningResource) => void;
}) => {
  const { t } = useTranslation();

  return (
    <tr
      key={record.id}
      style={{ cursor: 'pointer', height: 54 }}
      onClick={() => handlePreview(record)}>
      {/* Name */}
      <td
        style={{
          maxWidth: 360,
          overflow: 'hidden',
          paddingTop: 0,
          paddingBottom: 0,
          padding: '0 16px',
          borderBottom: '1px solid #EAECF0',
        }}>
        <div className="d-flex items-center gap-2" style={{ minWidth: 0 }}>
          {getResourceTypeIcon(record.resourceType)}
          <span
            className="text-sm font-medium"
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
            title={record.displayName || record.name}>
            {record.displayName || record.name}
          </span>
        </div>
      </td>

      {/* Categories */}
      <td
        style={{
          overflow: 'hidden',
          paddingTop: 0,
          paddingBottom: 0,
          padding: '0 16px',
          borderBottom: '1px solid #EAECF0',
        }}>
        <div
          className="d-flex items-center gap-2"
          style={{ flexWrap: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
          <div
            className="d-flex items-center gap-2"
            style={{
              flexShrink: 1,
              minWidth: 0,
              overflow: 'hidden',
              flexWrap: 'nowrap',
            }}>
            {record.categories?.slice(0, MAX_VISIBLE_TAGS).map((cat) => (
              <Badge
                color={CATEGORY_BADGE_COLORS[cat] ?? 'gray'}
                key={cat}
                size="sm"
                type="color">
                {LEARNING_CATEGORIES[cat as keyof typeof LEARNING_CATEGORIES]
                  ?.label ?? cat}
              </Badge>
            ))}
          </div>
          {record.categories && record.categories.length > MAX_VISIBLE_TAGS && (
            <Badge color="brand" size="sm" type="color">
              {`+${record.categories.length - MAX_VISIBLE_TAGS}`}
            </Badge>
          )}
        </div>
      </td>

      {/* Context */}
      <td
        style={{
          overflow: 'hidden',
          paddingTop: 0,
          paddingBottom: 0,
          padding: '0 16px',
          borderBottom: '1px solid #EAECF0',
        }}>
        <div
          className="d-flex items-center gap-2"
          style={{ flexWrap: 'nowrap', overflow: 'hidden', minWidth: 0 }}>
          <div
            className="d-flex items-center gap-2"
            style={{
              flexShrink: 1,
              minWidth: 0,
              overflow: 'hidden',
              flexWrap: 'nowrap',
            }}>
            {record.contexts?.slice(0, MAX_VISIBLE_CONTEXTS).map((ctx, i) => (
              <Badge color="gray" key={ctx.pageId ?? i} size="sm" type="color">
                {PAGE_IDS.find((p) => p.value === ctx.pageId)?.label ??
                  ctx.pageId}
              </Badge>
            ))}
          </div>
          {record.contexts && record.contexts.length > MAX_VISIBLE_CONTEXTS && (
            <Badge color="gray" size="sm" type="color">
              {`+${record.contexts.length - MAX_VISIBLE_CONTEXTS}`}
            </Badge>
          )}
        </div>
      </td>

      {/* Updated */}
      <td
        style={{
          paddingTop: 0,
          paddingBottom: 0,
          padding: '0 16px',
          borderBottom: '1px solid #EAECF0',
        }}>
        <span className="text-sm" style={{ color: '#667085' }}>
          {record.updatedAt
            ? DateTime.fromMillis(record.updatedAt).toFormat('LLL d, yyyy')
            : '-'}
        </span>
      </td>

      {/* Actions */}
      <td
        style={{
          paddingTop: 0,
          paddingBottom: 0,
          padding: '0 16px',
          borderBottom: '1px solid #EAECF0',
        }}
        onClick={(e) => e.stopPropagation()}>
        <div className="d-flex items-center gap-2">
          <ButtonUtility
            color="secondary"
            data-testid={`edit-${record.name}`}
            icon={<IconEdit height={14} width={14} />}
            size="xs"
            tooltip={t('label.edit')}
            onClick={() => handleEdit(record)}
          />
          <ButtonUtility
            color="secondary"
            data-testid={`delete-${record.name}`}
            icon={<Trash01 size={14} />}
            size="xs"
            tooltip={t('label.delete')}
            onClick={() => handleDelete(record)}
          />
        </div>
      </td>
    </tr>
  );
};

export const LearningResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [filterState, setFilterState] = useState<LearningResourceFilterState>(
    {}
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_BASE);

  const { resources, paging, isLoading, refetch } = useLearningResources({
    searchText,
    filterState,
    pageSize,
    currentPage,
  });

  const {
    isFormOpen,
    isPlayerOpen,
    isDeleteModalOpen,
    isDeleting,
    selectedResource,
    editingResource,
    deletingResource,
    handleCreate,
    handleEdit,
    handleDelete,
    handleDeleteConfirm,
    handleDeleteCancel,
    handlePreview,
    handleFormClose,
    handlePlayerClose,
  } = useLearningResourceActions({ onRefetch: refetch });

  const { view, viewToggle } = useViewToggle({ defaultView: 'table' });

  const { search } = useSearch({
    searchPlaceholder: t('label.search-entity', {
      entity: t('label.resource'),
    }),
    onSearchChange: setSearchText,
    initialSearchQuery: searchText,
  });

  const { quickFilters, filterSelectionDisplay } = useLearningResourceFilters({
    filterState,
    onFilterChange: setFilterState,
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, filterState]);

  const handlePageSizeChange = useCallback((size: number) => {
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const breadcrumbs = useMemo(
    () => [
      { name: t('label.setting-plural'), url: getSettingPath() },
      {
        name: t('label.preference-plural'),
        url: getSettingPath(GlobalSettingsMenuCategory.PREFERENCES),
      },
      { name: t('label.learning-resource'), url: '' },
    ],
    [t]
  );

  const paginationData = useMemo(
    () => ({
      paging: { total: paging.total },
      pagingHandler: ({ currentPage: page }: { currentPage: number }) =>
        setCurrentPage(page),
      pageSize,
      currentPage,
      isNumberBased: true,
      isLoading,
      pageSizeOptions: [PAGE_SIZE_BASE, PAGE_SIZE_MEDIUM, PAGE_SIZE_LARGE],
      onShowSizeChange: handlePageSizeChange,
    }),
    [paging.total, pageSize, currentPage, isLoading, handlePageSizeChange]
  );

  return (
    <PageLayoutV1
      fullHeight
      mainContainerClassName="learning-resources-page-layout"
      pageTitle={t('label.learning-resource')}>
      <div
        data-testid="learning-resources-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}>
        <div style={{ flexShrink: 0, marginBottom: 16 }}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </div>

        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 8,
            padding: 24,
            marginBottom: 16,
            background: '#fff',
            boxShadow: '0 1px 2px 0 rgba(16,24,40,0.06)',
            borderRadius: 8,
            border: '1px solid #E2E8F0',
          }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span
              className="font-semibold text-md"
              style={{ color: '#101828' }}>
              {t('label.learning-resource')}
            </span>
            <span
              className="text-sm"
              style={{ color: '#667085', fontWeight: 400 }}>
              {t('message.learning-resources-management-description')}
            </span>
          </div>

          <Button
            color="primary"
            data-testid="create-resource"
            iconLeading={Plus}
            size="md"
            onClick={handleCreate}>
            {t('label.add-entity', {
              entity: t('label.resource'),
            })}
          </Button>
        </div>

        {/* Table / Card Container */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginTop: 10,
            borderRadius: 12,
            border: '1px solid #E2E8F0',
          }}>
          {/* Filters */}
          <div style={{ flexShrink: 0, padding: 12 }}>
            <div className="d-flex items-center gap-3">
              {search}
              {quickFilters}
              <div style={{ flexGrow: 1 }} />
              {viewToggle}
            </div>
            {filterSelectionDisplay}
          </div>

          {/* Table View */}
          {view === 'table' && (
            <>
              <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
                <table
                  style={{
                    width: '100%',
                    tableLayout: 'fixed',
                    borderCollapse: 'collapse',
                  }}>
                  <thead>
                    <tr>
                      {[
                        { label: t('label.content-name'), width: 360 },
                        { label: t('label.category-plural'), width: 220 },
                        { label: t('label.context'), width: 220 },
                        { label: t('label.updated-at'), width: 140 },
                        { label: t('label.action-plural'), width: 80 },
                      ].map((col) => (
                        <th
                          className="text-xs font-semibold"
                          key={col.label}
                          style={{
                            background: '#F9FAFB',
                            width: col.width,
                            minWidth: col.width,
                            padding: '8px 16px',
                            textAlign: 'left',
                            color: '#475467',
                            position: 'sticky',
                            top: 0,
                            zIndex: 1,
                            borderBottom: '1px solid #EAECF0',
                          }}>
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody data-testid="learning-resources-table-body">
                    {isLoading ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ textAlign: 'center', padding: 16 }}>
                          <Loader />
                        </td>
                      </tr>
                    ) : isEmpty(resources) ? (
                      <tr>
                        <td
                          colSpan={5}
                          style={{ textAlign: 'center', padding: 16 }}>
                          {t('server.no-records-found')}
                        </td>
                      </tr>
                    ) : (
                      resources.map((record) => (
                        <ResourceRow
                          handleDelete={handleDelete}
                          handleEdit={handleEdit}
                          handlePreview={handlePreview}
                          key={record.id}
                          record={record}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div
                style={{
                  flexShrink: 0,
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'center',
                  boxShadow:
                    '0 -13px 16px -4px rgba(10, 13, 18, 0.04), 0 -4px 6px -2px rgba(10, 13, 18, 0.03)',
                }}>
                <NextPrevious {...paginationData} />
              </div>
            </>
          )}

          {/* Card View */}
          {view === 'card' && (
            <>
              <div style={{ padding: 12, overflow: 'auto' }}>
                {isLoading ? (
                  <Loader />
                ) : (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(280px,1fr))',
                      gap: 16,
                    }}>
                    {resources.map((r) => (
                      <LearningResourceCard
                        key={r.id}
                        resource={r}
                        onClick={handlePreview}
                      />
                    ))}
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: 16,
                  display: 'flex',
                  justifyContent: 'center',
                  boxShadow:
                    '0 -13px 16px -4px rgba(10, 13, 18, 0.04), 0 -4px 6px -2px rgba(10, 13, 18, 0.03)',
                }}>
                <NextPrevious {...paginationData} />
              </div>
            </>
          )}
        </div>

        {isFormOpen && (
          <LearningResourceForm
            open={isFormOpen}
            resource={editingResource}
            onClose={handleFormClose}
          />
        )}

        {selectedResource && (
          <ResourcePlayerModal
            open={isPlayerOpen}
            resource={selectedResource}
            onClose={handlePlayerClose}
          />
        )}

        {deletingResource && (
          <DeleteModalMUI
            entityTitle={deletingResource.displayName || deletingResource.name}
            isDeleting={isDeleting}
            message={t('message.delete-entity-permanently', {
              entityType: t('label.learning-resource'),
            })}
            open={isDeleteModalOpen}
            onCancel={handleDeleteCancel}
            onDelete={handleDeleteConfirm}
          />
        )}
      </div>
    </PageLayoutV1>
  );
};
