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
import { useTranslation } from 'react-i18next';
import { SettingType } from '../../../generated/settings/settings';
import {
  getGlossarySettings,
  updateGlossarySettings,
} from '../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const QUERY_KEY = ['settings', SettingType.GlossarySettings];

const GlossarySettings = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: getGlossarySettings,
  });
  const { mutate, isPending: isSaving } = useMutation({
    mutationFn: updateGlossarySettings,
    onSuccess: (settings) => {
      queryClient.setQueryData(QUERY_KEY, settings);
      showSuccessToast(
        t('server.entity-updated-success', { entity: t('label.glossary') })
      );
    },
    onError: (error: AxiosError) => showErrorToast(error),
  });

  return (
    <Box className="tw:p-6" data-testid="glossary-settings" direction="col">
      <Card>
        <Card.Header title={t('label.glossary')} />
        <Card.Content>
          {isPending && (
            <Typography role="status">{t('label.loading')}</Typography>
          )}
          {isError && (
            <Box direction="col" gap={4}>
              <Typography role="alert">
                {t('server.entity-fetch-error', {
                  entity: t('label.glossary'),
                })}
              </Typography>
              <Button color="secondary" onPress={() => refetch()}>
                {t('label.retry')}
              </Button>
            </Box>
          )}
          {data && !isError && (
            <Toggle
              className="tw:w-full"
              hint={t('message.glossary-tag-propagation-description')}
              isDisabled={isSaving}
              isSelected={data.enableTagPropagation !== false}
              label={t('label.glossary-tag-propagation')}
              size="md"
              onChange={(enableTagPropagation) =>
                mutate({ enableTagPropagation })
              }
            />
          )}
          <Typography as="p" className="tw:mt-4 tw:text-tertiary">
            {t('message.glossary-tag-propagation-reindex')}
          </Typography>
        </Card.Content>
      </Card>
    </Box>
  );
};

export default GlossarySettings;
