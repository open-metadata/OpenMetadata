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

import { render } from '@testing-library/react';
import React from 'react';
import Stepper from '.';

describe('Test Stepper Component', () => {
  it('Should render all the steps', async () => {
    const { findByText, getAllByTestId } = render(
      <Stepper steps={[{ name: 'step-1' }, { name: 'step-2' }]} />
    );
    const step1 = await findByText(/step-1/);
    const step2 = await findByText(/step-2/);
    const step1Icon = await findByText('1');
    const step2Icon = await findByText('2');

    expect(step1).toBeInTheDocument();
    expect(step2).toBeInTheDocument();
    expect(step1Icon).toBeInTheDocument();
    expect(step2Icon).toBeInTheDocument();

    const steps = getAllByTestId('step');

    expect(steps[0]).toHaveClass('step-doing');
    expect(steps[1]).toHaveClass('step-pending');
  });

  it('Should render without step numbers', () => {
    const { getAllByTestId } = render(
      <Stepper
        showStepNumber={false}
        steps={[{ name: 'step-1' }, { name: 'step-2' }]}
      />
    );
    const stepIcons = getAllByTestId('step-icon');

    expect(stepIcons.map((icon) => icon.textContent)).toEqual(['', '']);
  });

  it('Should render steps with active step 1', () => {
    const { getAllByTestId } = render(
      <Stepper
        activeStep={1}
        steps={[{ name: 'step-1' }, { name: 'step-2' }]}
      />
    );

    const steps = getAllByTestId('step');

    expect(steps[0]).toHaveClass('step-done');
    expect(steps[1]).toHaveClass('step-doing');
  });
});
