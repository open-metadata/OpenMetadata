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

import PropTypes from 'prop-types';
import React from 'react';
import StepConnector from './StepConnector';
import StepIcon from './StepIcon';
import StepLabel from './StepLabel';

const Step = ({
  activeStep,
  index,
  name,
  totalSteps,
  isVertical,
  showStepNumber,
}) => {
  return (
    <div
      className={`step-${
        index < activeStep ? 'done' : activeStep === index ? 'doing' : 'pending'
      } step`}
      data-testid="step"
      key={name}>
      {index > 0 && index < totalSteps && (
        <StepConnector isVertical={isVertical} />
      )}
      <span className="step-container">
        <StepIcon stepNumber={showStepNumber ? index + 1 : null} />
        <StepLabel name={name} />
      </span>
    </div>
  );
};

Step.propTypes = {
  activeStep: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  name: PropTypes.string,
  totalSteps: PropTypes.number.isRequired,
  isVertical: PropTypes.bool,
  showStepNumber: PropTypes.bool,
};

export default Step;
