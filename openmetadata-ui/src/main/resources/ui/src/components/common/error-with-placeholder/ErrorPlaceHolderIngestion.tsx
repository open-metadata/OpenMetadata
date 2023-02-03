/*
 *  Copyright 2022 Collate.
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

import { t } from 'i18next';
import React from 'react';
import { CUSTOM_AIRFLOW_DOCS } from '../../../constants/constants';

const ErrorPlaceHolderIngestion = () => {
  const airflowSetupGuide = () => {
    return (
      <div className="tw-mb-5" data-testid="error-steps">
        <div className="tw-card tw-flex tw-flex-col tw-justify-between tw-p-5 tw-w-4/5 tw-mx-auto">
          <div>
            <h6 className="tw-text-base tw-text-grey-body tw-font-medium">
              {t('message.manage-airflow-api')}
            </h6>

            <p className="tw-text-grey-body tw-text-sm tw-mb-5">
              {t('message.airflow-guide-message')}
            </p>
          </div>

          <p>
            <a
              href={CUSTOM_AIRFLOW_DOCS}
              rel="noopener noreferrer"
              target="_blank">
              {`${t('label.install-airflow-api')} >>`}
            </a>
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="tw-mt-5 tw-text-base tw-font-medium">
      {airflowSetupGuide()}
    </div>
  );
};

export default ErrorPlaceHolderIngestion;
