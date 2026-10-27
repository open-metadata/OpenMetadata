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
import { Box, Button } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import React, { useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { SYSTEM_ANNOUNCEMENT_SUB_PATHS } from '../../../../../constants/platform/systemAnnouncements.constants';
import { useSystemAnnouncementsList } from '../../../../../hooks/platform/useSystemAnnouncements';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import { NotificationSectionProps } from '../../../../../utils/ExtensionPointTypes';
import { withSuspenseFallback } from '../../../../AppRouter/withSuspenseFallback';
import SystemAnnouncementsTable from '../SystemAnnouncementsTable/SystemAnnouncementsTable';
import { parseAnnouncementSectionPath } from './AnnouncementsNotificationSection.utils';

// The form carries the rich-text editor; load it only once a form is opened.
const SystemAnnouncementFormLoader = withSuspenseFallback(
  React.lazy(
    () => import('../SystemAnnouncementFormLoader/SystemAnnouncementFormLoader')
  )
);

/**
 * Announcements inside the settings modal's Notification tab (AI mode). The
 * section stays mounted across its own sub-pages, so the list's search, filters
 * and page survive a trip to the form and back.
 */
const AnnouncementsNotificationSection = ({
  subPath,
  onNavigate,
  onSetHeaderActions,
  onSetSubTitle,
}: NotificationSectionProps) => {
  const { t } = useTranslation();
  const list = useSystemAnnouncementsList();
  const { view, id } = useMemo(
    () => parseAnnouncementSectionPath(subPath),
    [subPath]
  );
  const addLabel = t('label.add-entity', { entity: t('label.announcement') });
  // A duplicate saves a new announcement, so it reads as an add.
  const subTitle = {
    list: null,
    create: addLabel,
    duplicate: addLabel,
    edit: t('label.edit-entity', { entity: t('label.announcement') }),
  }[view];

  const openAdd = () => onNavigate?.(SYSTEM_ANNOUNCEMENT_SUB_PATHS.ADD);
  const openRow =
    (action: 'EDIT' | 'DUPLICATE') => (announcement: AnnouncementEntity) =>
      onNavigate?.(
        `${SYSTEM_ANNOUNCEMENT_SUB_PATHS[action]}/${announcement.id}`
      );
  const backToList = () => onNavigate?.();

  useEffect(() => {
    onSetHeaderActions?.(
      view === 'list' ? (
        <Button
          color="primary"
          data-testid="add-announcement"
          iconLeading={Plus}
          size="sm"
          onPress={() => onNavigate?.(SYSTEM_ANNOUNCEMENT_SUB_PATHS.ADD)}>
          {addLabel}
        </Button>
      ) : null
    );
    onSetSubTitle?.(subTitle);
  }, [view, addLabel, subTitle, onNavigate, onSetHeaderActions, onSetSubTitle]);

  // The panel does not reset what a section pushed into its header.
  useEffect(
    () => () => {
      onSetHeaderActions?.(null);
      onSetSubTitle?.(null);
    },
    [onSetHeaderActions, onSetSubTitle]
  );

  if (view === 'list') {
    return (
      <Box
        className="tw:px-8 tw:pb-8"
        data-testid="announcements-notification-section"
        direction="col">
        <SystemAnnouncementsTable
          list={list}
          onAdd={openAdd}
          onDuplicate={openRow('DUPLICATE')}
          onEdit={openRow('EDIT')}
        />
      </Box>
    );
  }

  return (
    <SystemAnnouncementFormLoader
      centered
      id={id}
      mode={view}
      onCancel={backToList}
      onSaved={backToList}
    />
  );
};

export default AnnouncementsNotificationSection;
