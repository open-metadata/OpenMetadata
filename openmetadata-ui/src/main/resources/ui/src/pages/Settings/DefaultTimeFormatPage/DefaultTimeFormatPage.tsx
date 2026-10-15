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
  RadioButton,
  RadioGroup,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import TitleBreadcrumb from '../../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import PageHeader from '../../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../../constants/GlobalSettings.constants';
import { TIME_FORMAT_OPTIONS } from '../../../components/discovery/personal-space/Profile/tabs/platform-settings/TimeFormatSettings.constants';
import { DefaultTimeFormat } from '../../../generated/api/configuration/appConfiguration';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../rest/settingConfigAPI';
import { getSettingPageEntityBreadCrumb } from '../../../utils/GlobalSettingsUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const DefaultTimeFormatPage: React.FC = () => {
  const { t } = useTranslation();
  const setTimeFormat = useApplicationStore((state) => state.setTimeFormat);
  const pageTitle = t('label.default-time-format');
  const [initialValue, setInitialValue] = useState<DefaultTimeFormat>(
    DefaultTimeFormat.The12H
  );
  const [currentValue, setCurrentValue] = useState<DefaultTimeFormat>(
    DefaultTimeFormat.The12H
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const breadcrumbs = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        pageTitle
      ),
    [pageTitle]
  );

  useEffect(() => {
    let isMounted = true;
    getAppConfiguration()
      .then((config) => {
        if (!isMounted) {
          return;
        }
        const initial = config?.defaultTimeFormat ?? DefaultTimeFormat.The12H;
        setInitialValue(initial);
        setCurrentValue(initial);
      })
      .catch((error: AxiosError) => showErrorToast(error))
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const isDirty = currentValue !== initialValue;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await patchAppConfiguration({ defaultTimeFormat: currentValue });
      setInitialValue(currentValue);
      setTimeFormat(currentValue);
      showSuccessToast(
        t('server.entity-updated-success', { entity: pageTitle })
      );
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageLayoutV1 pageTitle={pageTitle}>
      <Box
        className="page-container m-x-auto"
        data-testid="default-time-format-page"
        direction="col"
        gap={4}>
        <TitleBreadcrumb titleLinks={breadcrumbs} />
        <PageHeader
          data={{
            header: pageTitle,
            subHeader: t('message.default-time-format-description'),
          }}
        />
        <Card>
          <Card.Content>
            <RadioGroup
              aria-label={pageTitle}
              data-testid="time-format-radio-group"
              value={currentValue}
              onChange={(value) => setCurrentValue(value as DefaultTimeFormat)}>
              {TIME_FORMAT_OPTIONS.map((option) => (
                <RadioButton
                  data-testid={`time-format-option-${option.value}`}
                  key={option.value}
                  label={t(option.labelKey)}
                  value={option.value}
                />
              ))}
            </RadioGroup>
          </Card.Content>
          <Card.Footer>
            <Button
              color="primary"
              data-testid="save-time-format-settings"
              isDisabled={!isDirty || isLoading || isSaving}
              isLoading={isSaving}
              onPress={handleSave}>
              {t('label.save')}
            </Button>
          </Card.Footer>
        </Card>
      </Box>
    </PageLayoutV1>
  );
};

export default DefaultTimeFormatPage;
