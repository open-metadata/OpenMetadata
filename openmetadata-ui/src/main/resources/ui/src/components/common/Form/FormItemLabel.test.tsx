/*
 *  Copyright 2023 Collate.
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
import { HelperTextType } from '../../../interface/FormUtils.interface';
import { FormItemLabelProps } from './Form.interface';
import FormItemLabel from './FormItemLabel';

const mockProps: FormItemLabelProps = {
  label: 'name',
};

describe('Test FormItemLabel Component', () => {
  it('Should render FormItemLabel component', async () => {
    render(<FormItemLabel {...mockProps} />);

    const label = screen.getByTestId('form-item-label');

    expect(label).toContainHTML(mockProps.label as string);
  });

  it('Should not render helper icon if no helper text passed', async () => {
    render(<FormItemLabel {...mockProps} />);

    const label = screen.getByTestId('form-item-label');

    const helpIcon = screen.queryByTestId('helper-icon');

    expect(label).toContainHTML(mockProps.label as string);
    expect(helpIcon).not.toBeInTheDocument();
  });

  it('Should not render helper icon if type is not tooltip', async () => {
    render(
      <FormItemLabel {...mockProps} helperTextType={HelperTextType.ALERT} />
    );

    const label = screen.getByTestId('form-item-label');

    const helpIcon = screen.queryByTestId('helper-icon');

    expect(label).toContainHTML(mockProps.label as string);
    expect(helpIcon).not.toBeInTheDocument();
  });

  it('Should not render helper icon if showHelperText is false', async () => {
    render(<FormItemLabel {...mockProps} />);

    const label = screen.getByTestId('form-item-label');

    const helpIcon = screen.queryByTestId('helper-icon');

    expect(label).toContainHTML(mockProps.label as string);
    expect(helpIcon).not.toBeInTheDocument();
  });

  it('Should render helper icon if helper text is passed and type is tooltip', async () => {
    render(<FormItemLabel {...mockProps} showHelperText helperText="help" />);

    const label = screen.getByTestId('form-item-label');

    const helpIcon = screen.getByTestId('helper-icon');

    expect(label).toContainHTML(mockProps.label as string);
    expect(helpIcon).toBeInTheDocument();
  });

  it('Should render beta badge if isBeta is true', async () => {
    render(<FormItemLabel {...mockProps} isBeta />);

    const label = screen.getByTestId('form-item-label');

    const betaBadge = screen.getByText('label.beta');

    expect(label).toContainHTML(mockProps.label as string);
    expect(betaBadge).toBeInTheDocument();
  });

  it('Should not render beta badge if isBeta is false', async () => {
    render(<FormItemLabel {...mockProps} />);

    const label = screen.getByTestId('form-item-label');

    const betaBadge = screen.queryByText('label.beta');

    expect(label).toContainHTML(mockProps.label as string);
    expect(betaBadge).not.toBeInTheDocument();
  });
});
