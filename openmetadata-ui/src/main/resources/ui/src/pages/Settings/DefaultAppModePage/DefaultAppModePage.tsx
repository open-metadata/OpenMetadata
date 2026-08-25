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
  RadioButton,
  RadioGroup,
  Typography,
} from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DocumentTitle from '../../../components/common/DocumentTitle/DocumentTitle';
import { DefaultAppMode } from '../../../generated/api/configuration/appConfiguration';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

// Sentinel value for the "no tenant default" radio option — the wire value
// for that choice is `null`, but native form controls can't carry `null` as
// a value, so we translate at the option/handler boundary only.
const NO_DEFAULT_VALUE = 'null';

interface AppModeOption {
  value: string;
  labelKey: string;
}

// The tenant default is the fixed `DefaultAppMode` wire enum (`ai` | `classic`)
// plus the "no default" sentinel — not a runtime registry — so the options are
// a static list rather than something derived from the router.
const OPTIONS: AppModeOption[] = [
  { value: NO_DEFAULT_VALUE, labelKey: 'label.no-default' },
  { value: DefaultAppMode.Classic, labelKey: 'label.classic' },
  { value: DefaultAppMode.AI, labelKey: 'label.ai' },
];

const DefaultAppModePage: React.FC = () => {
  const { t } = useTranslation();
  const pageTitle = t('label.default-app-mode');
  const [initialValue, setInitialValue] = useState<string>(NO_DEFAULT_VALUE);
  const [currentValue, setCurrentValue] = useState<string>(NO_DEFAULT_VALUE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getAppConfiguration()
      .then((config) => {
        if (!isMounted) {
          return;
        }
        const initial = config?.defaultAppMode ?? NO_DEFAULT_VALUE;
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
      const defaultAppMode =
        currentValue === NO_DEFAULT_VALUE
          ? null
          : (currentValue as DefaultAppMode);
      await patchAppConfiguration({ defaultAppMode });
      setInitialValue(currentValue);
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
    <Box className="tw:p-6" data-testid="default-app-mode-page" direction="col">
      <DocumentTitle title={pageTitle} />
      <Typography as="h1" className="tw:text-2xl tw:font-semibold tw:mb-2">
        {pageTitle}
      </Typography>
      <Typography as="p" className="tw:text-secondary tw:mb-6">
        {t('message.default-app-mode-description')}
      </Typography>
      <RadioGroup
        aria-label={pageTitle}
        data-testid="app-mode-radio-group"
        value={currentValue}
        onChange={setCurrentValue}>
        {OPTIONS.map((option) => (
          <RadioButton
            data-testid={`app-mode-option-${option.value}`}
            key={option.value}
            label={t(option.labelKey)}
            value={option.value}
          />
        ))}
      </RadioGroup>
      <Box className="tw:mt-6">
        <Button
          color="primary"
          data-testid="save-app-mode-settings"
          isDisabled={!isDirty || isLoading || isSaving}
          isLoading={isSaving}
          onPress={handleSave}>
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );
};

export default DefaultAppModePage;
