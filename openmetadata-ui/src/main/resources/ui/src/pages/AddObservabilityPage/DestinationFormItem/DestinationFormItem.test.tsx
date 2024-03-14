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
}));

jest.mock('../../../utils/ObservabilityUtils', () => ({
  checkIfDestinationIsInternal: jest.fn().mockImplementation(() => false),
  getAlertDestinationCategoryIcons: jest
    .fn()
    .mockImplementation(() => <span data-testid="icon">Icon</span>),
}));

const mockProps = {
  heading: 'heading',
  subHeading: 'subHeading',
  buttonLabel: 'buttonLabel',
};

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

    render(<DestinationFormItem {...mockProps} />);

    expect(screen.getByText('heading')).toBeInTheDocument();
    expect(screen.getByText('subHeading')).toBeInTheDocument();
    expect(screen.getByText('buttonLabel')).toBeInTheDocument();

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

    render(<DestinationFormItem {...mockProps} />);

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

    render(<DestinationFormItem {...mockProps} />);

    expect(screen.getByTestId('add-destination-button')).toBeEnabled();
  });
});
