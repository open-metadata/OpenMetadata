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

import { ONBOARDING_STEPS_DATA } from 'constants/Onboarding.constants';
import { t } from 'i18next';
import { uniqueId } from 'lodash';
import React, { FC } from 'react';

const Onboarding: FC = () => {
  return (
    <div
      className="tw-mt-10 tw-text-base tw-font-medium"
      data-testid="onboarding">
      <div className="tw-text-center tw-text-xl tw-font-semibold tw-mb-1">
        {t('message.welcome-to-open-metadata')}
      </div>
      <div className="tw-mb-5">
        <div className="tw-mb-3 tw-text-center">
          {t('message.om-description')}
        </div>
        <div className="tw-grid tw-grid-cols-3 tw-gap-3 tw-mt-5">
          {ONBOARDING_STEPS_DATA.map((data) => (
            <div
              className="tw-card tw-flex tw-flex-col tw-justify-between tw-p-5"
              key={uniqueId()}>
              <div>
                <div className="tw-flex tw-mb-2">
                  <div className="tw-rounded-full tw-flex tw-justify-center tw-items-center tw-h-10 tw-w-10 tw-border-2 tw-border-primary tw-text-lg tw-font-bold tw-text-primary">
                    {data.step}
                  </div>
                </div>

                <h6
                  className="tw-text-base tw-text-grey-body tw-font-medium"
                  data-testid="service-name">
                  {t(data.title)}
                </h6>

                <p className="tw-text-grey-body tw-pb-1 tw-text-sm tw-mb-5">
                  {t(data.description)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
