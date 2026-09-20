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
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import {
  getAppConfiguration,
  patchAppConfiguration,
} from '../../../rest/settingConfigAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';

const NO_DEFAULT_VALUE = 'null';

interface TimeFormatOption {
  value: string;
  labelKey: string;
}

const OPTIONS: TimeFormatOption[] = [
  { value: NO_DEFAULT_VALUE, labelKey: 'label.no-default' },
  { value: '12h', labelKey: 'label.12-hour-format' },
  { value: '24h', labelKey: 'label.24-hour-format' },
];

const DefaultTimeFormatPage: React.FC = () => {
  const { t } = useTranslation();
  const { setTimeFormat } = useApplicationStore((state) => ({
    setTimeFormat: state.setTimeFormat,
  }));

  const pageTitle = t('label.default-time-format');
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
        const initial = config?.defaultTimeFormat ?? NO_DEFAULT_VALUE;
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
      const defaultTimeFormat =
        currentValue === NO_DEFAULT_VALUE
          ? null
          : (currentValue as '12h' | '24h');

      await patchAppConfiguration({ defaultTimeFormat });
      setInitialValue(currentValue);

      // Update the global store immediately so the UI reflects the change reactively.
      // If the admin cleared the default (null), fall back to the hardcoded '12h' default.
      setTimeFormat(defaultTimeFormat ?? '12h');

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
    <Box className="tw:p-6" data-testid="default-time-format-page" direction="col">
      <DocumentTitle title={pageTitle} />
      <Typography as="h1" className="tw:text-2xl tw:font-semibold tw:mb-2">
        {pageTitle}
      </Typography>
      <Typography as="p" className="tw:text-secondary tw:mb-6">
        {t('message.default-time-format-description')}
      </Typography>
      <RadioGroup
        aria-label={pageTitle}
        data-testid="time-format-radio-group"
        value={currentValue}
        onChange={setCurrentValue}>
        {OPTIONS.map((option) => (
          <RadioButton
            data-testid={`time-format-option-${option.value}`}
            key={option.value}
            label={t(option.labelKey)}
            value={option.value}
          />
        ))}
      </RadioGroup>
      <Box className="tw:mt-6">
        <Button
          color="primary"
          data-testid="save-time-format-settings"
          isDisabled={!isDirty || isLoading || isSaving}
          isLoading={isSaving}
          onPress={handleSave}>
          {t('label.save')}
        </Button>
      </Box>
    </Box>
  );
};

export default DefaultTimeFormatPage;