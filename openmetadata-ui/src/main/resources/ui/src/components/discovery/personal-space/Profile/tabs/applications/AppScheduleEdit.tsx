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
import { getAppCronExpression } from '../../../../../../utils/ApplicationUtils';
import { useAppScheduleOptions } from '../../../../../Settings/Applications/AppSchedule/useAppScheduleOptions';
import ScheduleInterval from '../../../../../Settings/Services/AddIngestion/Steps/ScheduleInterval';
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

  return (
    <Box
      className="tw:mx-auto tw:w-3/5"
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
          onPress={onCancel}>
          {t('label.cancel')}
        </Button>
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
