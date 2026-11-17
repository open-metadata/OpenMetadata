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
import { FC, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUnsavedChangesPrompt } from '../../../../../../hooks/discovery/personal-space/useUnsavedChangesPrompt';
import { getAppCronExpression } from '../../../../../../utils/ApplicationUtils';
import { useAppScheduleOptions } from '../../../../../Settings/Applications/AppSchedule/useAppScheduleOptions';
import ScheduleInterval from '../../../../../Settings/Services/AddIngestion/Steps/ScheduleInterval';
import UnsavedChangesPrompt from '../../components/UnsavedChangesPrompt';
import { AppFooter } from './AppFooter';
import type { AppScheduleEditProps } from './Applications.types';

/** Schedule editing as a page of the app detail, with its actions in the modal footer. */
const AppScheduleEdit: FC<AppScheduleEditProps> = ({
  appData,
  isSaving,
  onCancel,
  onSave,
}) => {
  const { t } = useTranslation();
  const { initialOptions, defaultCron } = useAppScheduleOptions(appData);
  const [scheduleValue, setScheduleValue] = useState(() =>
    getAppCronExpression(appData.appSchedule)
  );
  const [isScheduleValid, setIsScheduleValid] = useState(true);
  const { runGuarded, promptProps } = useUnsavedChangesPrompt(
    scheduleValue !== getAppCronExpression(appData.appSchedule)
  );

  return (
    <Box
      className="tw:mx-auto tw:w-full tw:max-w-[50%]"
      data-testid="update-schedule-form"
      direction="col">
      <ScheduleInterval
        defaultSchedule={defaultCron}
        includePeriodOptions={initialOptions}
        value={scheduleValue}
        onChange={setScheduleValue}
        onValidityChange={setIsScheduleValid}
      />
      <AppFooter testId="app-schedule-footer">
        <Button
          color="tertiary"
          data-testid="cancel-button"
          isDisabled={isSaving}
          onPress={() => runGuarded(onCancel)}>
          {t('label.cancel')}
        </Button>
        <UnsavedChangesPrompt {...promptProps} />
        <Button
          color="primary"
          data-testid="save-button"
          isDisabled={!isScheduleValid}
          isLoading={isSaving}
          onPress={() => onSave(scheduleValue ?? '')}>
          {t('label.save')}
        </Button>
      </AppFooter>
    </Box>
  );
};

export default AppScheduleEdit;
