/*
 *  Copyright 2025 Collate.
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

import { Check } from '@untitledui/icons';
import classNames from 'classnames';
import { Fragment, ReactElement } from 'react';

interface StepItem {
  name: string;
  step: number;
}

interface ServiceFlowStepperProps {
  steps: StepItem[];
  activeStep: number;
  className?: string;
}

type StepState = 'completed' | 'current' | 'upcoming';

const NODE_BASE =
  'tw:flex tw:size-[26px] tw:flex-shrink-0 tw:items-center tw:justify-center tw:rounded-full';

const LABEL_CLASS_BY_STATE: Record<StepState, string> = {
  completed: 'tw:font-semibold tw:text-brand-secondary',
  current: 'tw:font-semibold tw:text-brand-secondary',
  upcoming: 'tw:font-medium tw:text-tertiary',
};

const getStepState = (step: number, activeStep: number): StepState => {
  let state: StepState = 'upcoming';
  if (step < activeStep) {
    state = 'completed';
  } else if (step === activeStep) {
    state = 'current';
  }

  return state;
};

const StepNode = ({ state }: { state: StepState }) => {
  const nodeByState: Record<StepState, ReactElement> = {
    completed: (
      <span className={classNames(NODE_BASE, 'tw:bg-brand-solid')}>
        <Check className="tw:text-primary_on-brand" size={14} />
      </span>
    ),
    current: (
      <span
        className={classNames(
          NODE_BASE,
          'tw:border-2 tw:border-brand tw:bg-primary'
        )}>
        <span className="tw:size-2 tw:rounded-full tw:bg-brand-solid" />
      </span>
    ),
    upcoming: (
      <span
        className={classNames(
          NODE_BASE,
          'tw:border-2 tw:border-primary tw:bg-primary'
        )}
      />
    ),
  };

  return nodeByState[state];
};

const ServiceFlowStepper = ({
  steps,
  activeStep,
  className = '',
}: ServiceFlowStepperProps) => (
  <div
    className={classNames(
      'tw:mx-auto tw:flex tw:w-fit tw:max-w-full tw:items-start tw:justify-center',
      className
    )}
    data-testid="stepper-container">
    {steps.map((item, index) => {
      const state = getStepState(item.step, activeStep);
      const isLast = index === steps.length - 1;

      return (
        <Fragment key={item.name}>
          <div className="tw:flex tw:w-[120px] tw:flex-col tw:items-center tw:gap-2.5">
            <StepNode state={state} />
            <span
              className={classNames(
                'tw:text-center tw:text-sm',
                LABEL_CLASS_BY_STATE[state]
              )}
              data-testid={`step-label-${item.step}`}>
              {item.name}
            </span>
          </div>
          {!isLast && (
            <div
              className={classNames(
                'tw:mt-[11px] tw:h-0.5 tw:w-[100px] tw:flex-none tw:rounded-full',
                state === 'completed'
                  ? 'tw:bg-brand-solid'
                  : 'tw:bg-[var(--tw-color-border-primary)]'
              )}
              data-testid={`step-connector-${item.step}`}
            />
          )}
        </Fragment>
      );
    })}
  </div>
);

export default ServiceFlowStepper;
