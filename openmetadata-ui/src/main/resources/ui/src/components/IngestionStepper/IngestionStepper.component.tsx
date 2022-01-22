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

import classNames from 'classnames';
import React, { Fragment } from 'react';
import './IngestionStepper.css';
type Props = {
  steps: Array<{ name: string; step: number }>;
  activeStep: number;
  stepperLineClassName?: string;
};
const IngestionStepper = ({
  steps,
  activeStep,
  stepperLineClassName = '',
}: Props) => {
  return (
    <div className="ingestion-content tw-relative">
      {steps.map((step, index) => (
        <Fragment key={index}>
          {index > 0 && index < steps.length && (
            <span
              className={classNames('ingestion-line', stepperLineClassName)}
            />
          )}
          <div className="ingestion-wrapper" key={index}>
            <span className="tw-flex tw-flex-col">
              <span
                className={classNames(
                  'ingestion-rounder tw-self-center',
                  {
                    active: step.step === activeStep,
                  },
                  { completed: step.step < activeStep }
                )}
              />
              <span
                className={classNames('tw-mt-2 tw-text-xs', {
                  'tw-text-primary': step.step <= activeStep,
                })}>
                {step.name}
              </span>
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
};

export default IngestionStepper;
