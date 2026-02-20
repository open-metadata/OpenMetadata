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
import {
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import { defaultColors } from '@openmetadata/ui-core-components';
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

import { LearningResourceCard } from '../../components/Learning/LearningResourceCard/LearningResourceCard.component';
import { ResourcePlayerModal } from '../../components/Learning/ResourcePlayer/ResourcePlayerModal.component';
import { LearningResourceForm } from './LearningResourceForm.component';

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
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: 0.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
      <Icon height={24} width={24} />
    </Box>
  );
};

const getCategoryColors = (category: string) => {
  const info =
    LEARNING_CATEGORIES[category as keyof typeof LEARNING_CATEGORIES];

  return {
    bg: info?.bgColor,
    border: info?.borderColor,
    color: info?.color,
  };
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
  const theme = useTheme();

  return (
    <TableRow
      key={record.id}
      sx={{
        cursor: 'pointer',
        height: '54px !important',
        '& .MuiTableCell-root': {
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
      onClick={() => handlePreview(record)}>
      {/* Name */}
      <TableCell
        sx={{
          maxWidth: 360,
          overflow: 'hidden',
        }}>
        <Stack
          alignItems="center"
          direction="row"
          spacing={1}
          sx={{ minWidth: 0 }}>
          {getResourceTypeIcon(record.resourceType)}
          <Typography
            noWrap
            sx={{
              fontSize: theme.typography.body2.fontSize,
              fontWeight: theme.typography.fontWeightMedium,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
            title={record.displayName || record.name}>
            {record.displayName || record.name}
          </Typography>
        </Stack>
      </TableCell>

      {/* Categories */}
      <TableCell sx={{ overflow: 'hidden' }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            flexWrap: 'nowrap',
            overflow: 'hidden',
            alignItems: 'center',
            minWidth: 0,
          }}>
          <Box
            sx={{
              flexShrink: 1,
              minWidth: 0,
              overflow: 'hidden',
              display: 'flex',
              flexWrap: 'nowrap',
              gap: theme.spacing(1.5),
              alignItems: 'center',
            }}>
            {record.categories?.slice(0, MAX_VISIBLE_TAGS).map((cat) => {
              const c = getCategoryColors(cat);

              return (
                <Chip
                  key={cat}
                  label={LEARNING_CATEGORIES[cat]?.label ?? cat}
                  size="small"
                  sx={{
                    flexShrink: 1,
                    minWidth: 0,
                    maxWidth: '100%',
                    borderRadius: '6px',
                    bgcolor: c.bg,
                    border: `1px solid ${c.border}`,
                    color: c.color,
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    },
                  }}
                />
              );
            })}
          </Box>
          {record.categories && record.categories.length > MAX_VISIBLE_TAGS && (
            <Chip
              label={`+${record.categories.length - MAX_VISIBLE_TAGS}`}
              size="small"
              sx={{
                flexShrink: 0,
                borderRadius: '6px',
                backgroundColor:
                  'var(--Component-colors-Utility-Brand-utility-brand-50, #EFF8FF)',
                color: theme.palette.primary.main,
                border: 'none',
              }}
            />
          )}
        </Stack>
      </TableCell>

      {/* Context */}
      <TableCell sx={{ overflow: 'hidden' }}>
        <Stack
          direction="row"
          spacing={0.75}
          sx={{
            flexWrap: 'nowrap',
            overflow: 'hidden',
            alignItems: 'center',
            minWidth: 0,
          }}>
          <Box
            sx={{
              flexShrink: 1,
              minWidth: 0,
              overflow: 'hidden',
              display: 'flex',
              flexWrap: 'nowrap',
              gap: theme.spacing(1.5),
              alignItems: 'center',
            }}>
            {record.contexts?.slice(0, MAX_VISIBLE_CONTEXTS).map((ctx, i) => (
              <Chip
                key={ctx.pageId ?? i}
                label={
                  PAGE_IDS.find((p) => p.value === ctx.pageId)?.label ??
                  ctx.pageId
                }
                size="small"
                sx={{
                  flexShrink: 1,
                  minWidth: 0,
                  maxWidth: '100%',
                  borderRadius: '6px',
                  border: `1px solid ${theme.palette.grey[200]}`,
                  backgroundColor: theme.palette.grey[50],
                  padding: theme.spacing(0.25, 0.75),
                  color: theme.palette.grey[700],
                  '& .MuiChip-label': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                }}
              />
            ))}
          </Box>
          {record.contexts && record.contexts.length > MAX_VISIBLE_CONTEXTS && (
            <Chip
              label={`+${record.contexts.length - MAX_VISIBLE_CONTEXTS}`}
              size="small"
              sx={{
                flexShrink: 0,
                borderRadius: '6px',
                border: `1px solid ${theme.palette.grey[200]}`,
                backgroundColor: theme.palette.grey[50],
                padding: theme.spacing(0.25, 0.75),
                color: theme.palette.grey[700],
              }}
            />
          )}
        </Stack>
      </TableCell>

      {/* Updated */}
      <TableCell>
        <Typography
          component="span"
          sx={{
            color: theme.palette.grey[600],
            fontSize: theme.typography.body2.fontSize,
          }}>
          {record.updatedAt
            ? DateTime.fromMillis(record.updatedAt).toFormat('LLL d, yyyy')
            : '-'}
        </Typography>
      </TableCell>

      {/* Actions */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Box sx={{ display: 'flex', gap: '10px' }}>
          <Tooltip title={t('label.edit')}>
            <IconButton
              data-testid={`edit-${record.name}`}
              size="small"
              sx={{
                borderRadius: '4px',
                padding: theme.spacing(1),
                border: `1px solid ${theme.palette.grey[200]}`,
                bgcolor: 'common.white',
                '&:hover': {
                  bgcolor: 'common.white',
                },
              }}
              onClick={() => handleEdit(record)}>
              <IconEdit height={14} width={14} />
            </IconButton>
          </Tooltip>

          <Tooltip title={t('label.delete')}>
            <IconButton
              data-testid={`delete-${record.name}`}
              size="small"
              sx={{
                borderRadius: '4px',
                border: `1px solid ${theme.palette.grey[200]}`,
                padding: theme.spacing(1),
                bgcolor: 'common.white',
                '&:hover': {
                  bgcolor: 'common.white',
                },
              }}
              onClick={() => handleDelete(record)}>
              <Trash01 size={14} />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
};

export const LearningResourcesPage: React.FC = () => {
  const { t } = useTranslation();
  const theme = useTheme();
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
      <Box
        data-testid="learning-resources-page"
        sx={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}>
        <Box sx={{ flexShrink: 0, marginBottom: theme.spacing(2) }}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Box>

        {/* Header */}
        <Box
          sx={{
            flexShrink: 0,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: theme.spacing(1),
            padding: theme.spacing(6),
            mb: 2,
            bgcolor: 'background.paper',
            boxShadow: 1,
            borderRadius: 1,
            border: `1px solid ${defaultColors.blueGray[100]}`,
          }}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing(2 / 3),
            }}>
            <Typography
              sx={{
                color: theme.palette.grey[900],
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.body1.fontSize,
                fontWeight: 600,
                lineHeight: theme.typography.body1.lineHeight,
              }}>
              {t('label.learning-resource')}
            </Typography>
            <Typography
              sx={{
                color: theme.palette.grey[600],
                fontFamily: theme.typography.fontFamily,
                fontSize: theme.typography.body2.fontSize,
                fontWeight: 400,
                lineHeight: theme.typography.body2.lineHeight,
              }}>
              {t('message.learning-resources-management-description')}
            </Typography>
          </Box>

          <Button
            data-testid="create-resource"
            startIcon={
              <Plus style={{ fontSize: theme.typography.pxToRem(16) }} />
            }
            sx={{
              fontSize: theme.typography.body2.fontSize,
              fontWeight: theme.typography.fontWeightMedium,
              color: defaultColors.white,
              borderRadius: '8px',
              border: `1px solid ${defaultColors.blue[600]}`,
              background: defaultColors.blue[600],
              padding: theme.spacing(2, 3.5),
              '&:hover': {
                background: defaultColors.blue[600],
                color: defaultColors.white,
              },
            }}
            variant="text"
            onClick={handleCreate}>
            {t('label.add-entity', {
              entity: t('label.resource'),
            })}
          </Button>
        </Box>

        {/* Table / Card Container */}
        <Paper
          elevation={0}
          sx={{
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            marginTop: theme.spacing(2.5),
            borderRadius: '12px',
            border: `1px solid ${defaultColors.blueGray[100]}`,
          }}>
          {/* Filters */}
          <Box
            sx={{
              flexShrink: 0,
              p: 3,
            }}>
            <Stack alignItems="center" direction="row" spacing={2}>
              {search}
              {quickFilters}
              <Box flexGrow={1} />
              {viewToggle}
            </Stack>
            {filterSelectionDisplay}
          </Box>

          {/* Table View */}
          {view === 'table' && (
            <>
              <TableContainer
                sx={{
                  flex: 1,
                  minHeight: 0,
                  overflow: 'auto',
                  borderRadius: 0, // Ensure no border radius here either
                }}>
                <Table stickyHeader size="small" sx={{ tableLayout: 'fixed' }}>
                  <TableHead>
                    <TableRow>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'grey.50',
                          maxWidth: 360,
                          width: 360,
                        }}>
                        {t('label.content-name')}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'grey.50',
                          width: 220,
                          minWidth: 220,
                        }}>
                        {t('label.category-plural')}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'grey.50',
                          width: 220,
                          minWidth: 220,
                        }}>
                        {t('label.context')}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'grey.50',
                          width: 140,
                          minWidth: 140,
                        }}>
                        {t('label.updated-at')}
                      </TableCell>
                      <TableCell
                        sx={{
                          fontWeight: 600,
                          bgcolor: 'grey.50',
                          width: 80,
                          minWidth: 80,
                        }}>
                        {t('label.action-plural')}
                      </TableCell>
                    </TableRow>
                  </TableHead>

                  <TableBody data-testid="learning-resources-table-body">
                    {isLoading ? (
                      <TableRow>
                        <TableCell align="center" colSpan={5}>
                          <Loader />
                        </TableCell>
                      </TableRow>
                    ) : isEmpty(resources) ? (
                      <TableRow>
                        <TableCell align="center" colSpan={5}>
                          {t('server.no-records-found')}
                        </TableCell>
                      </TableRow>
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
                  </TableBody>
                </Table>
              </TableContainer>

              <Box
                sx={{
                  flexShrink: 0,
                  p: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  boxShadow:
                    '0 -13px 16px -4px rgba(10, 13, 18, 0.04), 0 -4px 6px -2px rgba(10, 13, 18, 0.03)',
                }}>
                <NextPrevious {...paginationData} />
              </Box>
            </>
          )}

          {/* Card View */}
          {view === 'card' && (
            <>
              <Box sx={{ p: 3, overflow: 'auto' }}>
                {isLoading ? (
                  <Loader />
                ) : (
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fill, minmax(280px,1fr))',
                      gap: 2,
                    }}>
                    {resources.map((r) => (
                      <LearningResourceCard
                        key={r.id}
                        resource={r}
                        onClick={handlePreview}
                      />
                    ))}
                  </Box>
                )}
              </Box>

              <Box
                sx={{
                  p: 2,
                  display: 'flex',
                  justifyContent: 'center',
                  boxShadow:
                    '0 -13px 16px -4px rgba(10, 13, 18, 0.04), 0 -4px 6px -2px rgba(10, 13, 18, 0.03)',
                }}>
                <NextPrevious {...paginationData} />
              </Box>
            </>
          )}
        </Paper>

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
      </Box>
    </PageLayoutV1>
  );
};
