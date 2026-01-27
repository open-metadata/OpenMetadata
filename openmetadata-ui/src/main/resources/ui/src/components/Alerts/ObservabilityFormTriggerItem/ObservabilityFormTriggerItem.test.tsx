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
import ObservabilityFormTriggerItem from './ObservabilityFormTriggerItem';

jest.mock('../../../utils/Alerts/AlertsUtil', () => ({
  getConditionalField: jest
    .fn()
    .mockReturnValue(<div data-testid="condition-field" />),
  getSupportedFilterOptions: jest.fn().mockReturnValue([]),
}));

const mockSupportedTriggers = MOCK_FILTER_RESOURCES.reduce(
  (resource, current) => {
    resource.push(...(current.supportedActions ?? []));

    return resource;
  },
  [] as EventFilterRule[]
);

describe('ObservabilityFormTriggerItem', () => {
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
      <Form>
        <ObservabilityFormTriggerItem
          supportedTriggers={mockSupportedTriggers}
        />
      </Form>
    );

    expect(screen.getByText('label.trigger')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-trigger-description')
    ).toBeInTheDocument();

    expect(screen.getByTestId('triggers-list')).toBeInTheDocument();
    expect(screen.getByTestId('add-trigger')).toBeInTheDocument();
  });

  it('add trigger button should be disabled if there is no selected trigger and filters', () => {
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
      <Form>
        <ObservabilityFormTriggerItem
          supportedTriggers={mockSupportedTriggers}
        />
      </Form>
    );

    const addButton = screen.getByTestId('add-trigger');

    expect(addButton).toBeDisabled();
  });

  it('add trigger button should not be disabled if there is selected trigger and filters', () => {
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
      <Form>
        <ObservabilityFormTriggerItem
          supportedTriggers={mockSupportedTriggers}
        />
      </Form>
    );

    const addButton = screen.getByTestId('add-trigger');

    expect(addButton).not.toBeDisabled();
  });

  it('should render form item with proper label alignment', () => {
    const setFieldValue = jest.fn();
    const getFieldValue = jest.fn().mockImplementation((path) => {
      if (Array.isArray(path) && path[0] === 'input' && path[1] === 'actions') {
        return [{ name: 'trigger1', effect: 'include' }];
      }
      if (Array.isArray(path) && path[0] === 'resources') {
        return ['container'];
      }

      return undefined;
    });
    jest.spyOn(Form, 'useFormInstance').mockImplementation(
      () =>
        ({
          setFieldValue,
          getFieldValue,
        } as unknown as FormInstance)
    );

    const useWatchMock = jest.spyOn(Form, 'useWatch');
    useWatchMock.mockImplementation((path) => {
      if (Array.isArray(path) && path[0] === 'input' && path[1] === 'actions') {
        return [{ name: 'trigger1', effect: 'include' }];
      }
      if (Array.isArray(path) && path[0] === 'resources') {
        return ['container'];
      }

      return undefined;
    });

    const { container } = render(
      <Form
        initialValues={{
          input: { actions: [{ name: 'trigger1', effect: 'include' }] },
          resources: ['container'],
        }}>
        <ObservabilityFormTriggerItem
          supportedTriggers={mockSupportedTriggers}
        />
      </Form>
    );

    // Check that the effect field (Include switch) is rendered with correct label
    const includeLabel = screen.getByText('label.include');

    expect(includeLabel).toBeInTheDocument();

    // Check that the form items are properly structured with the updated labelAlign and labelCol
    const formItems = container.querySelectorAll('.ant-form-item');

    expect(formItems.length).toBeGreaterThan(0);
  });
});
