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

import { Steps } from 'antd';
import classNames from 'classnames';
import React, { useMemo } from 'react';

type Props = {
  steps: Array<{ name: string; step: number }>;
  activeStep: number;
  excludeSteps?: Array<number>;
};
const IngestionStepper = ({ steps, activeStep, excludeSteps = [] }: Props) => {
  const items = useMemo(
    () =>
      steps
        .filter((step) => !excludeSteps.includes(step.step))
        .map((step) => {
          return {
            icon: (
              <span
                className={classNames(
                  'ingestion-rounder tw-self-center',
                  {
                    active: step.step === activeStep,
                  },
                  { completed: step.step < activeStep }
                )}
                data-testid={`step-icon-${step.step}`}
              />
            ),
            key: step.name,
            title: step.name,
          };
        }),
    [steps, activeStep, excludeSteps]
  );

  return (
    <div className="tw-px-24" data-testid="stepper-container">
      <Steps
        current={activeStep}
        items={items}
        labelPlacement="vertical"
        size="small"
      />
    </div>
  );
};

export default IngestionStepper;
