/*
 *  Copyright 2024 Collate.
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
import userEvent from '@testing-library/user-event';
import React from 'react';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { useFqn } from '../../../hooks/useFqn';
import { MOCK_FILTER_RESOURCES } from '../../../test/unit/mocks/observability.mock';
import AlertFormSourceItem from './AlertFormSourceItem';

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: '' }),
}));

jest.mock('antd', () => {
  const antd = jest.requireActual('antd');

  return {
    ...antd,
    Form: {
      ...antd.Form,
      useFormInstance: jest.fn().mockImplementation(() => ({
        setFieldValue: jest.fn(),
        getFieldValue: jest.fn(),
      })),
    },
  };
});

describe('AlertFormSourceItem', () => {
  it('should renders without crashing', () => {
    render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByText('label.source')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-source-description')
    ).toBeInTheDocument();

    expect(screen.getByTestId('add-source-button')).toBeInTheDocument();
  });

  it('should render the trigger select when fqn is provided', () => {
    (useFqn as jest.Mock).mockImplementationOnce(() => ({
      fqn: 'test',
    }));

    render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />, {
      wrapper: MemoryRouter,
    });

    expect(screen.getByTestId('source-select')).toBeInTheDocument();
  });

  it('should display select dropdown when clicked on add trigger button', async () => {
    render(<AlertFormSourceItem filterResources={MOCK_FILTER_RESOURCES} />, {
      wrapper: MemoryRouter,
    });
    const addButton = screen.getByTestId('add-source-button');
    await act(async () => {
      userEvent.click(addButton);
    });

    expect(screen.getByTestId('drop-down-menu')).toBeInTheDocument();
  });
});
