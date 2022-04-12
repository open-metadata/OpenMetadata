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

import {
  findByTestId,
  findByText,
  fireEvent,
  render,
} from '@testing-library/react';
import React from 'react';
import ConfigureService from './ConfigureService';
import { ConfigureServiceProps } from './Steps.interface';

const mockConfigureServiceProps: ConfigureServiceProps = {
  serviceName: 'testService',
  description: '',
  showError: {
    name: false,
    duplicateName: false,
  },
  handleValidation: jest.fn(),
  onBack: jest.fn(),
  onNext: jest.fn(),
};

jest.mock('../../common/rich-text-editor/RichTextEditor', () => {
  return jest
    .fn()
    .mockImplementation(() => <div>RichTextEditor.component</div>);
});

describe('Test ConfigureService component', () => {
  it('ConfigureService component should render', async () => {
    const { container } = render(
      <ConfigureService {...mockConfigureServiceProps} />
    );

    const configureServiceContainer = await findByTestId(
      container,
      'configure-service-container'
    );
    const serviceName = await findByTestId(container, 'service-name');
    const backButton = await findByTestId(container, 'back-button');
    const nextButton = await findByTestId(container, 'next-button');
    const richTextEditor = await findByText(
      container,
      'RichTextEditor.component'
    );

    fireEvent.change(serviceName, {
      target: {
        value: 'newName',
      },
    });
    fireEvent.click(backButton);
    fireEvent.click(nextButton);

    expect(configureServiceContainer).toBeInTheDocument();
    expect(richTextEditor).toBeInTheDocument();
    expect(serviceName).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();
    expect(nextButton).toBeInTheDocument();
    expect(mockConfigureServiceProps.handleValidation).toBeCalled();
    expect(mockConfigureServiceProps.onBack).toBeCalled();
    expect(mockConfigureServiceProps.onNext).toBeCalled();
  });
});
