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
import { Form, FormInstance } from 'antd';
import React from 'react';
import { EventFilterRule } from '../../../generated/events/eventSubscription';
import { MOCK_FILTER_RESOURCES } from '../../../test/unit/mocks/observability.mock';
import ObservabilityFormActionItem from './ObservabilityFormActionItem';

jest.mock('../../../utils/Alerts/AlertsUtil', () => ({
  getConditionalField: jest
    .fn()
    .mockReturnValue(<div data-testid="condition-field" />),
  getSupportedFilterOptions: jest.fn().mockReturnValue([]),
}));

const mockSupportedActions = MOCK_FILTER_RESOURCES.reduce(
  (resource, current) => {
    resource.push(...(current.supportedActions ?? []));

    return resource;
  },
  [] as EventFilterRule[]
);

describe('ObservabilityFormActionItem', () => {
  it('should renders without crashing', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => ['container']);

    render(
      <ObservabilityFormActionItem supportedActions={mockSupportedActions} />
    );

    expect(screen.getByText('label.trigger')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-trigger-description')
    ).toBeInTheDocument();

    expect(screen.getByTestId('actions-list')).toBeInTheDocument();
    expect(screen.getByTestId('add-actions')).toBeInTheDocument();
  });

  it('add actions button should be disabled if there is no selected trigger and filters', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => []);

    render(
      <ObservabilityFormActionItem supportedActions={mockSupportedActions} />
    );

    const addButton = screen.getByTestId('add-actions');

    expect(addButton).toBeDisabled();
  });

  it('add actions button should not be disabled if there is selected trigger and filters', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn();
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation(() => ['container']);

    render(
      <ObservabilityFormActionItem supportedActions={mockSupportedActions} />
    );

    const addButton = screen.getByTestId('add-actions');

    expect(addButton).not.toBeDisabled();
  });
});
