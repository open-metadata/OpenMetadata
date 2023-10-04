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

import { Card } from 'antd';
import { t } from 'i18next';
import { uniqueId } from 'lodash';
import React, { FC } from 'react';
import { ONBOARDING_STEPS_DATA } from '../../constants/Onboarding.constants';

const Onboarding: FC = () => {
  return (
    <div className="text-base font-medium" data-testid="onboarding">
      <div className="text-center text-xl font-semibold ">
        {t('message.welcome-to-open-metadata')}
      </div>
      <div>
        <div className="text-center">{t('message.om-description')}</div>
        <div>
          {ONBOARDING_STEPS_DATA.map((data) => (
            <Card className="d-flex flex-col justify-between " key={uniqueId()}>
              <div>
                <div className="d-flex mb-2">
                  <div className="d-flex justify-center items-center text-lg font-bold text-primary">
                    {data.step}
                  </div>
                </div>

                <h6
                  className="text-base text-grey-body font-medium"
                  data-testid="service-name">
                  {t(data.title)}
                </h6>

                <p className="text-grey-body text-sm">{t(data.description)}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
