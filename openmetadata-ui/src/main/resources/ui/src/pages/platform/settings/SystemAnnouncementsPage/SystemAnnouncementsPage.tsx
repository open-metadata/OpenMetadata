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
import { Button, PageLayout } from '@openmetadata/ui-core-components';
import { Plus } from '@openmetadata/ui-core-components/icons';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import DocumentTitle from '../../../../components/common/DocumentTitle/DocumentTitle';
import HeaderBreadcrumb from '../../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import SystemAnnouncementsTable from '../../../../components/platform/settings/announcements/SystemAnnouncementsTable/SystemAnnouncementsTable';
import { PLACEHOLDER_ROUTE_ID, ROUTES } from '../../../../constants/constants';
import { useSystemAnnouncementsList } from '../../../../hooks/platform/useSystemAnnouncements';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { AnnouncementEntity } from '../../../../rest/announcementsAPI';
import { getSystemAnnouncementBreadcrumbs } from '../../../../utils/platform/systemAnnouncements.utils';

/**
 * Settings → Notifications → Announcements. One page for both app modes: the
 * header takes the AI gradient in AI mode, the list is the same.
 */
const SystemAnnouncementsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAiMode = useIsAiMode();
  const list = useSystemAnnouncementsList();
  const title = t('label.announcement-plural');

  const openAdd = () => navigate(ROUTES.SETTINGS_ANNOUNCEMENT_ADD);
  const openRow = (route: string) => (announcement: AnnouncementEntity) =>
    navigate(route.replace(PLACEHOLDER_ROUTE_ID, announcement.id));

  return (
    <PageLayout data-testid="system-announcements-page">
      <DocumentTitle title={title} />
      <PageLayout.PageHeader
        actions={
          <Button
            color="primary"
            data-testid="add-announcement"
            iconLeading={Plus}
            size="sm"
            onPress={openAdd}>
            {t('label.add-entity', { entity: t('label.announcement') })}
          </Button>
        }
        breadcrumb={
          <HeaderBreadcrumb
            noMargin
            className="tw:text-xs"
            items={getSystemAnnouncementBreadcrumbs()}
            showHome={false}
          />
        }
        subtitle={t('message.system-announcements-description')}
        title={title}
        variant={isAiMode ? 'gradient' : 'flat'}
      />
      <PageLayout.Content className={classNames({ 'tw:pt-4': isAiMode })}>
        <SystemAnnouncementsTable
          list={list}
          onAdd={openAdd}
          onDuplicate={openRow(ROUTES.SETTINGS_ANNOUNCEMENT_DUPLICATE)}
          onEdit={openRow(ROUTES.SETTINGS_ANNOUNCEMENT_EDIT)}
        />
      </PageLayout.Content>
    </PageLayout>
  );
};

export default SystemAnnouncementsPage;
