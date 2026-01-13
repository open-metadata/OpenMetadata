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
import { EventFilterRule } from '../../../generated/events/eventSubscription';
import { MOCK_FILTER_RESOURCES } from '../../../test/unit/mocks/observability.mock';
import ObservabilityFormFiltersItem from './ObservabilityFormFiltersItem';

jest.mock('../../../utils/Alerts/AlertsUtil', () => ({
  getConditionalField: jest
    .fn()
    .mockReturnValue(<div data-testid="condition-field" />),
  getSupportedFilterOptions: jest.fn().mockReturnValue([]),
}));

const mockSupportedFilters = MOCK_FILTER_RESOURCES.reduce(
  (resource, current) => {
    resource.push(...(current.supportedFilters ?? []));

    return resource;
  },
  [] as EventFilterRule[]
);

describe('ObservabilityFormFiltersItem', () => {
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
      <ObservabilityFormFiltersItem supportedFilters={mockSupportedFilters} />
    );

    expect(screen.getByText('label.filter-plural')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-filter-description')
    ).toBeInTheDocument();

    expect(screen.getByTestId('filters-list')).toBeInTheDocument();
    expect(screen.getByTestId('add-filters')).toBeInTheDocument();
  });

  it('add filter button should be disabled if there is no selected trigger', () => {
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
      <ObservabilityFormFiltersItem supportedFilters={mockSupportedFilters} />
    );

    const addButton = screen.getByTestId('add-filters');

    expect(addButton).toBeDisabled();
  });

  it('add filter button should not be disabled if there is selected trigger', () => {
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
      <ObservabilityFormFiltersItem supportedFilters={mockSupportedFilters} />
    );

    const addButton = screen.getByTestId('add-filters');

    expect(addButton).not.toBeDisabled();
  });
});
