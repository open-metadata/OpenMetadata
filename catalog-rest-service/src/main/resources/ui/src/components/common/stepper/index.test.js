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
