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

import {
  ProgressStepItem,
  ProgressSteps,
} from '@openmetadata/ui-core-components';

import classNames from 'classnames';
import { useMemo } from 'react';
import './ingestion-stepper.style.less';

type Props = {
  steps: Array<{
    name: string;
    step: number;
  }>;
  activeStep: number;
  excludeSteps?: Array<number>;
  className?: string;
};
const IngestionStepper = ({
  steps,
  activeStep,
  excludeSteps = [],
  className = '',
}: Props) => {
  const items = useMemo(
    () =>
      steps
        .filter((step) => !excludeSteps.includes(step.step))
        .map((step) => {
          let status: ProgressStepItem['status'] = 'incomplete';
          if (step.step === activeStep) {
            status = 'current';
          } else if (step.step < activeStep) {
            status = 'complete';
          }

          // Optional steps can leave gaps, so derive status from the original identifier.
          return {
            id: String(step.step),
            title: (
              <span data-testid={`step-icon-${step.step}`}>{step.name}</span>
            ),
            status,
          };
        }),
    [steps, activeStep, excludeSteps]
  );

  return (
    <div
      className={classNames('stepper-container p-x-24', className)}
      data-testid="stepper-container">
      <ProgressSteps
        labelPlacement="bottom"
        size="sm"
        steps={items}
        type="icon"
      />
    </div>
  );
};

export default IngestionStepper;
