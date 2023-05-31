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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import ConfigureService from './ConfigureService';
import { ConfigureServiceProps } from './Steps.interface';

const mockConfigureServiceProps: ConfigureServiceProps = {
  serviceName: 'testService',
  onBack: jest.fn(),
  onNext: jest.fn(),
};

describe('Test ConfigureService component', () => {
  it('ConfigureService component should render', async () => {
    render(<ConfigureService {...mockConfigureServiceProps} />);

    const configureServiceContainer = screen.getByTestId(
      'configure-service-container'
    );
    const serviceName = screen.getByTestId('service-name');
    const backButton = screen.getByTestId('back-button');
    const nextButton = screen.getByTestId('next-button');
    const richTextEditor = screen.getByTestId('editor');

    expect(configureServiceContainer).toBeInTheDocument();
    expect(richTextEditor).toBeInTheDocument();
    expect(serviceName).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
  });

  it('Back button should work', () => {
    render(<ConfigureService {...mockConfigureServiceProps} />);
    const backButton = screen.getByTestId('back-button');

    userEvent.click(backButton);

    expect(mockConfigureServiceProps.onBack).toHaveBeenCalled();
  });

  it('Next button should work', async () => {
    render(<ConfigureService {...mockConfigureServiceProps} />);
    const serviceName = screen.getByTestId('service-name');
    const nextButton = screen.getByTestId('next-button');

    userEvent.type(serviceName, 'newName');

    await act(async () => {
      userEvent.click(nextButton);
    });

    expect(serviceName).toHaveValue('newName');

    expect(mockConfigureServiceProps.onNext).toHaveBeenCalled();
    expect(mockConfigureServiceProps.onNext).toHaveBeenCalledWith({
      description: '',
      serviceName: 'newName',
    });
  });
});
