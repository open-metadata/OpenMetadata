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
import { render, screen } from '@testing-library/react';
import ServiceFlowStepper from './ServiceFlowStepper';

jest.mock('@untitledui/icons', () => ({
  Check: () => <span data-testid="check-icon" />,
}));

const steps = [
  { name: 'Select Service Type', step: 1 },
  { name: 'Connect', step: 2 },
  { name: 'What to Ingest', step: 3 },
];

describe('ServiceFlowStepper', () => {
  it('renders every step label', () => {
    render(<ServiceFlowStepper activeStep={1} steps={steps} />);

    expect(screen.getByText('Select Service Type')).toBeInTheDocument();
    expect(screen.getByText('Connect')).toBeInTheDocument();
    expect(screen.getByText('What to Ingest')).toBeInTheDocument();
  });

  it('renders one fewer connector than steps', () => {
    render(<ServiceFlowStepper activeStep={1} steps={steps} />);

    expect(screen.getByTestId('step-connector-1')).toBeInTheDocument();
    expect(screen.getByTestId('step-connector-2')).toBeInTheDocument();
    expect(screen.queryByTestId('step-connector-3')).not.toBeInTheDocument();
  });

  it('marks the active step label as current (brand) and prior steps completed', () => {
    render(<ServiceFlowStepper activeStep={2} steps={steps} />);

    expect(screen.getByTestId('step-label-2').className).toContain(
      'tw:text-brand-secondary'
    );
    expect(screen.getByTestId('step-label-1').className).toContain(
      'tw:text-brand-secondary'
    );
    expect(screen.getByTestId('step-label-3').className).toContain(
      'tw:text-tertiary'
    );
  });

  it('shows a completed check icon for steps before the active step', () => {
    render(<ServiceFlowStepper activeStep={3} steps={steps} />);

    expect(screen.getAllByTestId('check-icon')).toHaveLength(2);
  });
});
