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
  BadgeWithDot,
  BadgeWithIcon,
  Box,
  Button,
  Dropdown,
  FilterSelect,
  Input,
  PaginationCardWithControls,
  Skeleton,
  Table,
  TableCard,
  Typography,
} from '@openmetadata/ui-core-components';
import {
  AlertCircle,
  Announcement02,
  Copy01,
  Edit01,
  NoSearch,
  Search,
  Trash01,
} from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { DateTime } from 'luxon';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SYSTEM_ANNOUNCEMENT_PAGE_SIZES,
  SYSTEM_ANNOUNCEMENT_STATUS_LABEL_KEYS,
  SYSTEM_ANNOUNCEMENT_STATUS_ORDER,
} from '../../../../../constants/platform/systemAnnouncements.constants';
import {
  AnnouncementStatus,
  AnnouncementType,
} from '../../../../../generated/entity/feed/announcement';
import {
  SystemAnnouncementsListState,
  useDeleteSystemAnnouncement,
} from '../../../../../hooks/platform/useSystemAnnouncements';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import {
  ANNOUNCEMENT_STATUS_COLORS,
  ANNOUNCEMENT_TYPE_CONFIG,
  ANNOUNCEMENT_TYPE_ORDER,
  getAnnouncementStatus,
  getAnnouncementTypeConfig,
  getAnnouncementTypeLabel,
} from '../../../../../utils/AnnouncementsUtils';
import AnnouncementDeleteDialog from '../../../../Announcement/AnnouncementDeleteDialog';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import NoSearchResultsPlaceholder from '../../../../common/EmptyPlaceholder/NoSearchResultsPlaceholder';
import SomethingWentWrongPlaceholder from '../../../../common/EmptyPlaceholder/SomethingWentWrongPlaceholder';
import ProfilePicture from '../../../../common/ProfilePicture/ProfilePicture';

type ColumnId =
  | 'type'
  | 'title'
  | 'author'
  | 'startTime'
  | 'endTime'
  | 'status'
  | 'actions';

interface Column {
  id: ColumnId;
  label: string;
  className?: string;
}

interface SystemAnnouncementsTableProps {
  list: SystemAnnouncementsListState;
  onAdd: () => void;
  onDuplicate: (announcement: AnnouncementEntity) => void;
  onEdit: (announcement: AnnouncementEntity) => void;
}

// Announcements are scheduled by day, so the cell shows the day alone.
const DateCell = ({ value }: { value: number }) => (
  <Typography className="tw:text-primary" size="text-sm">
    {DateTime.fromMillis(value).toLocaleString(DateTime.DATE_MED)}
  </Typography>
);

const TypeCell = ({ announcement }: { announcement: AnnouncementEntity }) => {
  const { t } = useTranslation();
  const typeConfig = getAnnouncementTypeConfig(announcement);

  return (
    // A Custom type's name can run to 64 characters, so it truncates too.
    <BadgeWithIcon
      className="tw:max-w-full"
      color={typeConfig.color}
      iconLeading={typeConfig.icon}
      size="sm"
      type="color">
      <span className="tw:truncate">
        {getAnnouncementTypeLabel(typeConfig, t)}
      </span>
    </BadgeWithIcon>
  );
};

type RowAction = 'edit' | 'duplicate' | 'delete';

const RowActions = ({
  announcement,
  onDelete,
  onDuplicate,
  onEdit,
}: {
  announcement: AnnouncementEntity;
  onDelete: (announcement: AnnouncementEntity) => void;
  onDuplicate: (announcement: AnnouncementEntity) => void;
  onEdit: (announcement: AnnouncementEntity) => void;
}) => {
  const { t } = useTranslation();

  const handlers: Record<RowAction, typeof onEdit> = {
    edit: onEdit,
    duplicate: onDuplicate,
    delete: onDelete,
  };

  return (
    <Dropdown.Root>
      {/* Core draws the focus outline while the button is pressed, and the
          menu trigger stays pressed for as long as the menu is open. Only a
          keyboard focus keeps the ring. */}
      <Dropdown.DotsButton
        className={({ isFocusVisible, isPressed }) =>
          isPressed && !isFocusVisible ? 'tw:outline-0' : ''
        }
        data-testid={`announcement-actions-${announcement.name}`}
      />
      <Dropdown.Popover className="tw:w-min">
        <Dropdown.Menu
          aria-label={t('label.action-plural')}
          selectionMode="none"
          onAction={(key) => handlers[key as RowAction](announcement)}>
          <Dropdown.Item
            data-testid="edit-announcement"
            icon={Edit01}
            id="edit"
            label={t('label.edit')}
          />
          <Dropdown.Item
            data-testid="duplicate-announcement"
            icon={Copy01}
            id="duplicate"
            label={t('label.duplicate')}
          />
          <Dropdown.Separator />
          <Dropdown.Item
            data-testid="delete-announcement"
            icon={Trash01}
            id="delete"
            label={t('label.delete')}
          />
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown.Root>
  );
};

/**
 * The system-announcement list: server-side search and filters, cursor paging,
 * and Edit / Duplicate / Delete per row. It navigates nowhere itself — each
 * surface (the settings route, the settings modal) says where Add, Edit and
 * Duplicate lead, so the same table serves Classic and AI mode.
 */
const SystemAnnouncementsTable = ({
  list,
  onAdd,
  onDuplicate,
  onEdit,
}: SystemAnnouncementsTableProps) => {
  const { t } = useTranslation();
  const [pendingDelete, setPendingDelete] = useState<AnnouncementEntity>();
  const closeDelete = useCallback(() => setPendingDelete(undefined), []);
  const deleteMutation = useDeleteSystemAnnouncement(closeDelete);

  const {
    announcements,
    filters,
    hasFilters,
    isError,
    isLoading,
    page,
    pageCount,
    pageSize,
    total,
    clearFilters,
    goToPage,
    refetch,
    setPageSize,
    updateFilters,
  } = list;

  const columns: Column[] = useMemo(
    () => [
      { id: 'type', label: t('label.type'), className: 'tw:w-32' },
      { id: 'title', label: t('label.title') },
      { id: 'author', label: t('label.author'), className: 'tw:w-36' },
      { id: 'startTime', label: t('label.start-date'), className: 'tw:w-32' },
      { id: 'endTime', label: t('label.end-date'), className: 'tw:w-32' },
      { id: 'status', label: t('label.status'), className: 'tw:w-32' },
      {
        id: 'actions',
        label: t('label.action-plural'),
        className: 'tw:w-14',
      },
    ],
    [t]
  );

  const statusOptions = useMemo(
    () =>
      SYSTEM_ANNOUNCEMENT_STATUS_ORDER.map((status) => ({
        value: status,
        label: t(SYSTEM_ANNOUNCEMENT_STATUS_LABEL_KEYS[status]),
      })),
    [t]
  );

  const typeOptions = useMemo(
    () =>
      ANNOUNCEMENT_TYPE_ORDER.map((type) => ({
        value: type,
        label: t(ANNOUNCEMENT_TYPE_CONFIG[type].labelKey),
      })),
    [t]
  );

  const renderCell = (announcement: AnnouncementEntity, columnId: ColumnId) => {
    switch (columnId) {
      case 'type':
        return <TypeCell announcement={announcement} />;
      case 'title': {
        const title = announcement.displayName ?? announcement.name;

        return (
          // Core's Button wraps its label in a span of its own; that span is
          // what has to shrink for a long title to truncate in the cell. The
          // tooltip carries the full title.
          <Button
            className="tw:max-w-full tw:justify-start tw:text-left tw:[&>span]:min-w-0 tw:[&>span]:truncate"
            color="link-color"
            data-testid={`announcement-title-${announcement.name}`}
            size="sm"
            tooltip={title}
            tooltipPlacement="top"
            onPress={() => onEdit(announcement)}>
            {title}
          </Button>
        );
      }
      case 'author':
        return announcement.createdBy ? (
          <Box align="center" className="tw:min-w-0" gap={2}>
            <ProfilePicture name={announcement.createdBy} size="xs" />
            <Typography
              className="tw:truncate tw:text-secondary"
              size="text-sm">
              {announcement.createdBy}
            </Typography>
          </Box>
        ) : null;
      case 'startTime':
        return <DateCell value={announcement.startTime} />;
      case 'endTime':
        return <DateCell value={announcement.endTime} />;
      case 'status': {
        const status = getAnnouncementStatus(announcement);

        return (
          <BadgeWithDot
            color={ANNOUNCEMENT_STATUS_COLORS[status]}
            size="sm"
            type="pill-color">
            {t(SYSTEM_ANNOUNCEMENT_STATUS_LABEL_KEYS[status])}
          </BadgeWithDot>
        );
      }
      case 'actions':
        return (
          <RowActions
            announcement={announcement}
            onDelete={setPendingDelete}
            onDuplicate={onDuplicate}
            onEdit={onEdit}
          />
        );
    }
  };

  const renderEmptyState = () => {
    if (isLoading) {
      return (
        <Box className="tw:p-3" direction="col" gap={2}>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton height={28} key={i} variant="rounded" />
          ))}
        </Box>
      );
    }

    // A failed fetch leaves no rows too, but it must not read as "none exist"
    // and offer Add: that invites a duplicate of a banner already live.
    if (isError) {
      return (
        <div className="tw:relative tw:min-h-60">
          <SomethingWentWrongPlaceholder
            actions={[
              {
                color: 'primary' as const,
                key: 'retry',
                label: t('label.retry'),
                onPress: () => refetch(),
              },
            ]}
            data-testid="announcements-error"
            icon={<AlertCircle />}
            title={t('server.entity-fetch-error', {
              entity: t('label.announcement-plural'),
            })}
          />
        </div>
      );
    }

    return hasFilters ? (
      <div className="tw:relative tw:min-h-60">
        <NoSearchResultsPlaceholder
          data-testid="announcements-no-match"
          description={t('message.check-spelling-or-try-different-term')}
          icon={<NoSearch />}
          title={t('label.no-matching-results')}
        />
      </div>
    ) : (
      <div className="tw:relative tw:min-h-60">
        <NoDataPlaceholder
          actions={[
            {
              color: 'primary' as const,
              key: 'add-announcement',
              label: t('label.add-entity', {
                entity: t('label.announcement'),
              }),
              onPress: onAdd,
            },
          ]}
          data-testid="announcements-empty"
          description={t('message.no-system-announcements-description')}
          icon={<Announcement02 />}
          title={t('label.no-entity-found', {
            entity: t('label.announcement-plural'),
          })}
        />
      </div>
    );
  };

  return (
    <>
      <TableCard.Root
        className="tw:flex tw:flex-col"
        data-testid="system-announcements-table"
        size="sm">
        <Box
          align="center"
          className="tw:border-b tw:border-subtle tw:px-4 tw:py-3"
          gap={3}
          wrap="wrap">
          <Input
            aria-label={t('label.search-for-type', {
              type: t('label.announcement-plural'),
            })}
            className="tw:max-w-xs"
            data-testid="announcement-search"
            icon={Search}
            placeholder={`${t('label.search-for-type', {
              type: t('label.announcement-plural'),
            })}…`}
            value={filters.search}
            onChange={(search) => updateFilters({ search })}
          />
          <Box align="center" className="tw:ml-auto" gap={2}>
            {hasFilters && (
              <Button
                color="link-gray"
                data-testid="announcement-clear-filters"
                size="sm"
                onPress={clearFilters}>
                {t('label.clear')}
              </Button>
            )}
            <FilterSelect
              bordered
              data-testid="announcement-status-filter"
              label={t('label.status')}
              options={statusOptions}
              selectedValues={filters.status ? [filters.status] : []}
              selectionMode="single"
              onChange={([status]) =>
                updateFilters({
                  status: status as AnnouncementStatus | undefined,
                })
              }
            />
            <FilterSelect
              bordered
              data-testid="announcement-type-filter"
              label={t('label.type')}
              options={typeOptions}
              selectedValues={filters.type ? [filters.type] : []}
              selectionMode="single"
              onChange={([type]) =>
                updateFilters({ type: type as AnnouncementType | undefined })
              }
            />
          </Box>
        </Box>
        <div className="tw:overflow-x-auto">
          <Table
            aria-label={t('label.announcement-plural')}
            // Below this the fixed columns would squeeze Title to nothing and
            // long titles would spill into Author; the wrapper scrolls instead.
            className="tw:table-fixed tw:min-w-220"
            data-testid="system-announcements-list"
            size="sm">
            <Table.Header columns={columns}>
              {(column) => (
                // The row-actions column has no visible heading, as in the
                // design; its name stays for screen readers.
                <Table.Head
                  className={column.className}
                  id={column.id}
                  isRowHeader={column.id === 'title'}
                  key={column.id}
                  label={column.id === 'actions' ? undefined : column.label}>
                  {column.id === 'actions' && (
                    <span className="tw:sr-only">{column.label}</span>
                  )}
                </Table.Head>
              )}
            </Table.Header>
            <Table.Body
              items={isLoading ? [] : announcements}
              renderEmptyState={renderEmptyState}>
              {(announcement) => (
                <Table.Row
                  className={classNames({
                    'tw:opacity-60':
                      getAnnouncementStatus(announcement) ===
                      AnnouncementStatus.Expired,
                  })}
                  columns={columns}
                  data-testid={`announcement-row-${announcement.name}`}
                  id={announcement.id}
                  key={announcement.id}>
                  {(column) => (
                    <Table.Cell className={column.className} key={column.id}>
                      {renderCell(announcement, column.id)}
                    </Table.Cell>
                  )}
                </Table.Row>
              )}
            </Table.Body>
          </Table>
        </div>
        {total > pageSize && (
          <PaginationCardWithControls
            page={page}
            pageSize={pageSize}
            pageSizeOptions={SYSTEM_ANNOUNCEMENT_PAGE_SIZES}
            total={pageCount}
            onPageChange={goToPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </TableCard.Root>

      <AnnouncementDeleteDialog
        isDeleting={deleteMutation.isPending}
        isOpen={Boolean(pendingDelete)}
        onCancel={closeDelete}
        onConfirm={() =>
          pendingDelete && deleteMutation.mutate(pendingDelete.id)
        }
      />
    </>
  );
};

export default SystemAnnouncementsTable;
