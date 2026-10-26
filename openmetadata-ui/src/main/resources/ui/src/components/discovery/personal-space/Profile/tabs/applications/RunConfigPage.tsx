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

import { Box } from '@openmetadata/ui-core-components';
import { noop } from 'lodash';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import applicationsClassBase from '../../../../../Settings/Applications/AppDetails/ApplicationsClassBase';
import type { RunConfigPageProps } from './Applications.types';

/** A past run's configuration, read-only, as a page under the app. */
const RunConfigPage: FC<RunConfigPageProps> = ({
  appData,
  jsonSchema,
  runConfig,
}) => {
  const { t } = useTranslation();
  const ConfigurationComponent =
    applicationsClassBase.getModalAppConfigurationComponent();

  return (
    <Box data-testid="app-run-config" direction="col">
      {jsonSchema && (
        <ConfigurationComponent
          isReadOnly
          appData={{ ...appData, appConfiguration: runConfig.config }}
          isSaving={false}
          jsonSchema={jsonSchema}
          showHint={false}
          submitLabel={t('label.save')}
          onSave={noop}
        />
      )}
    </Box>
  );
};

export default RunConfigPage;
