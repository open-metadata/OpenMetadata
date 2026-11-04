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
import { Box } from '@openmetadata/ui-core-components';
import { useTranslation } from 'react-i18next';
import { useSystemAnnouncement } from '../../../../../hooks/platform/useSystemAnnouncements';
import { AnnouncementEntity } from '../../../../../rest/announcementsAPI';
import NoDataPlaceholder from '../../../../common/EmptyPlaceholder/NoDataPlaceholder';
import Loader from '../../../../common/Loader/Loader';
import SystemAnnouncementForm from '../SystemAnnouncementForm/SystemAnnouncementForm';
import { SystemAnnouncementFormMode } from '../SystemAnnouncementForm/SystemAnnouncementForm.types';

interface SystemAnnouncementFormLoaderProps {
  mode: SystemAnnouncementFormMode;
  /** The announcement to edit or duplicate; unused when creating. */
  id?: string;
  onCancel: () => void;
  onSaved: (announcement: AnnouncementEntity) => void;
  centered?: boolean;
}

/**
 * Fetches the announcement an edit or duplicate starts from, then mounts the
 * form. The form reads its defaults once, so it must not mount before they
 * arrive — the rich-text editor in particular takes its content at mount only.
 */
const SystemAnnouncementFormLoader = ({
  mode,
  id,
  onCancel,
  onSaved,
  centered,
}: SystemAnnouncementFormLoaderProps) => {
  const { t } = useTranslation();
  const needsSource = mode !== 'create';
  const { data, isError, isLoading } = useSystemAnnouncement(
    needsSource ? id : undefined
  );

  if (needsSource && isLoading) {
    return <Loader />;
  }

  // A deleted announcement, or one that is not system-wide: this page only
  // manages announcements without an entity link.
  if (needsSource && (isError || !data || data.entityLink)) {
    return (
      <Box className="tw:relative tw:min-h-60">
        <NoDataPlaceholder
          data-testid="announcement-not-found"
          title={t('label.no-entity-found', {
            entity: t('label.announcement'),
          })}
        />
      </Box>
    );
  }

  return (
    <SystemAnnouncementForm
      announcement={needsSource ? data : undefined}
      centered={centered}
      key={data?.id ?? 'new'}
      mode={mode}
      onCancel={onCancel}
      onSaved={onSaved}
    />
  );
};

export default SystemAnnouncementFormLoader;
