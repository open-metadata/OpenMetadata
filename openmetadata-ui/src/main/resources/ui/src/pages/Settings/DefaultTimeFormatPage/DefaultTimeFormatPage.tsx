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

interface TimeFormatOption {
  value: string;
  labelKey: string;
}

const OPTIONS: TimeFormatOption[] = [
  { value: '12h', labelKey: 'label.12-hour-format' },
  { value: '24h', labelKey: 'label.24-hour-format' },
];

const DefaultTimeFormatPage: React.FC = () => {
  const { t } = useTranslation();
  const setTimeFormat = useApplicationStore((state) => state.setTimeFormat);
  const pageTitle = t('label.default-time-format');
  const [initialValue, setInitialValue] = useState<string>('12h');
  const [currentValue, setCurrentValue] = useState<string>('12h');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let isMounted = true;
    getAppConfiguration()
      .then((config) => {
        if (!isMounted) {
          return;
        }
        const initial = (config?.defaultTimeFormat as '12h' | '24h') || '12h';
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
      setTimeFormat(currentValue as '12h' | '24h');
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

      {/* Wrapper for Title - forces spacing below */}
      <div className="tw:mb-8">
        <Typography as="h1" className="tw:text-2xl tw:font-semibold">
          {pageTitle}
        </Typography>
      </div>

      {/* Wrapper for Description - forces spacing below */}
      <div className="tw:mb-10">
        <Typography as="p" className="tw:text-secondary tw:max-w-2xl">
          {t('message.default-time-format-description')}
        </Typography>
      </div>

      {/* Wrapper for Radio Group - forces spacing below */}
      <div className="tw:mb-8">
        <RadioGroup
          aria-label={pageTitle}
          data-testid="time-format-radio-group"
          value={currentValue}
          onChange={setCurrentValue}
        >
          {OPTIONS.map((option) => (
            // Wrapper for individual Radio Button - forces spacing between options
            <div key={option.value} className="tw:mb-4">
              <RadioButton
                data-testid={`time-format-option-${option.value}`}
                label={t(option.labelKey)}
                value={option.value}
              />
            </div>
          ))}
        </RadioGroup>
      </div>

      {/* Wrapper for Save Button - forces spacing above */}
      <div className="tw:mt-4">
        <Button
          color="primary"
          data-testid="save-time-format-settings"
          isDisabled={!isDirty || isLoading || isSaving}
          isLoading={isSaving}
          onPress={handleSave}
        >
          {t('label.save')}
        </Button>
      </div>
    </Box>
  );
};

export default DefaultTimeFormatPage;