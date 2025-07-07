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
import { DESTINATION_SOURCE_ITEMS } from '../../../constants/Alerts.constants';
import DestinationFormItem from './DestinationFormItem.component';

jest.mock('../../../utils/Alerts/AlertsUtil', () => ({
  getDestinationConfigField: jest
    .fn()
    .mockReturnValue(<div data-testid="destination-field" />),
  getSubscriptionTypeOptions: jest.fn().mockReturnValue([]),
  listLengthValidator: jest.fn().mockImplementation(() => Promise.resolve()),
  getFilteredDestinationOptions: jest
    .fn()
    .mockImplementation((key) => DESTINATION_SOURCE_ITEMS[key]),
  getConnectionTimeoutField: jest
    .fn()
    .mockReturnValue(<div data-testid="connection-timeout" />),
  getReadTimeoutField: jest
    .fn()
    .mockReturnValue(<div data-testid="read-timeout" />),
}));

jest.mock('../../../utils/ObservabilityUtils', () => ({
  checkIfDestinationIsInternal: jest.fn().mockImplementation(() => false),
  getAlertDestinationCategoryIcons: jest
    .fn()
    .mockImplementation(() => <span data-testid="icon">Icon</span>),
}));

jest.mock('../../../components/common/FormCardSection/FormCardSection', () =>
  jest.fn().mockImplementation(({ heading, subHeading, children }) => (
    <div>
      <div>{heading}</div>
      <div>{subHeading}</div>
      <div>{children}</div>
    </div>
  ))
);

describe('DestinationFormItem', () => {
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

    render(<DestinationFormItem />);

    expect(screen.getByText('label.destination')).toBeInTheDocument();
    expect(
      screen.getByText('message.alerts-destination-description')
    ).toBeInTheDocument();
    expect(screen.getByText('label.add-entity')).toBeInTheDocument();

    expect(screen.getByTestId('add-destination-button')).toBeInTheDocument();
  });

  it('add destination button should be disabled if there is no selected trigger', () => {
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

    render(<DestinationFormItem />);

    expect(screen.getByTestId('add-destination-button')).toBeDisabled();
  });

  it('add destination button should be enabled if there is selected trigger', () => {
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

    render(<DestinationFormItem />);

    expect(screen.getByTestId('add-destination-button')).toBeEnabled();
  });

  it('should display the connection timeout field', () => {
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

    render(<DestinationFormItem />);

    expect(screen.getByTestId('connection-timeout')).toBeInTheDocument();
  });
});
