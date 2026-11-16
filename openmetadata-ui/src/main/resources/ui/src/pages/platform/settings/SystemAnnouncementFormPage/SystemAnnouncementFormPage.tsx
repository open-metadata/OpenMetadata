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
import { PageLayout } from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import DocumentTitle from '../../../../components/common/DocumentTitle/DocumentTitle';
import HeaderBreadcrumb from '../../../../components/common/HeaderBreadcrumb/HeaderBreadcrumb.component';
import { SystemAnnouncementFormMode } from '../../../../components/platform/settings/announcements/SystemAnnouncementForm/SystemAnnouncementForm.types';
import SystemAnnouncementFormLoader from '../../../../components/platform/settings/announcements/SystemAnnouncementFormLoader/SystemAnnouncementFormLoader';
import { ROUTES } from '../../../../constants/constants';
import { useIsAiMode } from '../../../../hooks/useAppMode';
import { getSystemAnnouncementBreadcrumbs } from '../../../../utils/platform/systemAnnouncements.utils';

interface SystemAnnouncementFormPageProps {
  mode: SystemAnnouncementFormMode;
}

/** Add, edit or duplicate a system announcement, as its own settings page. */
const SystemAnnouncementFormPage = ({
  mode,
}: SystemAnnouncementFormPageProps) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isAiMode = useIsAiMode();
  const { id } = useParams<{ id: string }>();
  const entity = t('label.announcement');
  const title =
    mode === 'edit'
      ? t('label.edit-entity', { entity })
      : t('label.add-entity', { entity });

  const backToList = () => navigate(ROUTES.SETTINGS_ANNOUNCEMENTS);

  return (
    <PageLayout data-testid="system-announcement-form-page">
      <DocumentTitle title={title} />
      <PageLayout.PageHeader
        breadcrumb={
          <HeaderBreadcrumb
            noMargin
            className="tw:text-xs"
            items={getSystemAnnouncementBreadcrumbs(title)}
            showHome={false}
          />
        }
        subtitle={t('message.system-announcements-description')}
        title={title}
        variant={isAiMode ? 'gradient' : 'flat'}
      />
      <PageLayout.Content
        className={classNames('tw:flex tw:min-h-0 tw:flex-col', {
          'tw:pt-4': isAiMode,
        })}>
        <SystemAnnouncementFormLoader
          id={id}
          mode={mode}
          onCancel={backToList}
          onSaved={backToList}
        />
      </PageLayout.Content>
    </PageLayout>
  );
};

export default SystemAnnouncementFormPage;
