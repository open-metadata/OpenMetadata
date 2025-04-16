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

import { getByTestId, queryByTestId, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import IngestionStepper from './IngestionStepper.component';

describe('IngestionStepper Tests', () => {
  it('Component should render properly', () => {
    const { container } = render(
      <IngestionStepper
        activeStep={2}
        steps={[
          { name: 'step1', step: 1 },
          { name: 'step2', step: 2 },
          { name: 'step3', step: 3 },
        ]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const stepperContainer = getByTestId(container, 'stepper-container');
    const stepIcon1 = getByTestId(container, 'step-icon-1');
    const stepIcon2 = getByTestId(container, 'step-icon-2');
    const stepIcon3 = getByTestId(container, 'step-icon-3');

    expect(stepperContainer).toBeInTheDocument();
    expect(stepIcon1).toBeInTheDocument();
    expect(stepIcon2).toBeInTheDocument();
    expect(stepIcon3).toBeInTheDocument();
  });

  it('Excluded steps should not be displayed', async () => {
    const { container } = render(
      <IngestionStepper
        activeStep={2}
        excludeSteps={[2]}
        steps={[
          { name: 'step1', step: 1 },
          { name: 'step2', step: 2 },
          { name: 'step3', step: 3 },
        ]}
      />,
      {
        wrapper: MemoryRouter,
      }
    );
    const stepIcon2 = await queryByTestId(container, 'step-icon-2');

    expect(stepIcon2).toBeNull();
  });
});
