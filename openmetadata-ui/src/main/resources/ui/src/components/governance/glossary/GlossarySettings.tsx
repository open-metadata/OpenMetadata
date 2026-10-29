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
  Card,
  Toggle,
  Typography,
} from '@openmetadata/ui-core-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { SettingType } from '../../../generated/settings/settings';
import {
  getGlossarySettings,
  updateGlossarySettings,
} from '../../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import TitleBreadcrumb from '../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import SettingsSection, {
  ReadOnlyRow,
} from '../../discovery/personal-space/Profile/components/SettingsSection';
import PageHeader from '../../PageHeader/PageHeader.component';
import PageLayoutV1 from '../../PageLayoutV1/PageLayoutV1';

const QUERY_KEY = ['settings', SettingType.GlossarySettings];

// `embedded` renders as a section of the platform settings panel, which owns the page chrome.
const GlossarySettings = ({ embedded = false }: { embedded?: boolean }) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const pageTitle = t('label.glossary');
  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        pageTitle
      ),
    [pageTitle]
  );
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getGlossarySettings,
  });
  const { mutate, isPending: isSaving } = useMutation({
    mutationFn: updateGlossarySettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(QUERY_KEY, settings);
      showSuccessToast(
        t('server.entity-updated-success', { entity: pageTitle })
      );
    },
    onError: (error: AxiosError) => showErrorToast(error),
  });

  const status = (
    <>
      {isPending && <Typography role="status">{t('label.loading')}</Typography>}
      {isError && (
        <Box direction="col" gap={4}>
          <Typography role="alert">
            {t('server.entity-fetch-error', { entity: pageTitle })}
          </Typography>
          <Button color="secondary" onPress={() => refetch()}>
            {t('label.retry')}
          </Button>
        </Box>
      )}
    </>
  );
  const toggle = data && !isError && (
    <Toggle
      aria-label={t('label.glossary-tag-propagation')}
      isDisabled={isSaving}
      isSelected={data.enableTagPropagation !== false}
      size="md"
      onChange={(enableTagPropagation) => mutate({ enableTagPropagation })}
    />
  );

  const propagationRow = (
    <Box align="center" gap={4} justify="between">
      <Box direction="col" gap={1}>
        <Typography className="tw:text-primary" weight="medium">
          {t('label.glossary-tag-propagation')}
        </Typography>
        <Typography className="tw:text-tertiary" size="text-sm">
          {t('message.glossary-tag-propagation-reindex')}
        </Typography>
      </Box>
      {status}
      {toggle}
    </Box>
  );

  if (embedded) {
    return (
      <SettingsSection testId="glossary-settings" title={pageTitle}>
        <ReadOnlyRow
          description={t('message.glossary-tag-propagation-reindex')}
          title={t('label.glossary-tag-propagation')}>
          {status}
          {toggle}
        </ReadOnlyRow>
      </SettingsSection>
    );
  }

  return (
    <PageLayoutV1 pageTitle={pageTitle}>
      <Box
        className="page-container m-x-auto"
        data-testid="glossary-settings"
        direction="col"
        gap={4}>
        <TitleBreadcrumb titleLinks={breadcrumbs} />
        <PageHeader
          data={{
            header: pageTitle,
            subHeader: t('message.glossary-tag-propagation-description'),
          }}
        />
        <Card>
          <Card.Content>{propagationRow}</Card.Content>
        </Card>
      </Box>
    </PageLayoutV1>
  );
};

export default GlossarySettings;
