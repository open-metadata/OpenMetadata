/*
 *  Copyright 2021 Collate
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

import { uniqueId } from 'lodash';
import React, { FC } from 'react';

const stepsData = [
  {
    step: 1,
    title: 'Explore Data',
    description: 'Look at the popular data assets in your organization.',
  },
  {
    step: 2,
    title: 'Claim Ownership',
    description:
      'Data works well when it is owned. Take a look at the data assets that you own and claim ownership.',
  },
  {
    step: 3,
    title: 'Stay Up-to-date',
    description:
      'Follow the datasets that you frequently use to stay informed about it.',
  },
];

const Onboarding: FC = () => {
  return (
    <div
      className="tw-mt-10 tw-text-base tw-font-medium"
      data-testid="onboarding">
      <div className="tw-text-center tw-text-xl tw-font-semibold tw-mb-1">
        Welcome to OpenMetadata!
      </div>
      <div className="tw-mb-5">
        <div className="tw-mb-3 tw-text-center">
          A central place to discover and collaborate on all your data
        </div>
        <div className="tw-grid tw-grid-cols-3 tw-gap-3 tw-mt-5">
          {stepsData.map((data) => (
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
                  {data.title}
                </h6>

                <p className="tw-text-grey-body tw-pb-1 tw-text-sm tw-mb-5">
                  {data.description}
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
