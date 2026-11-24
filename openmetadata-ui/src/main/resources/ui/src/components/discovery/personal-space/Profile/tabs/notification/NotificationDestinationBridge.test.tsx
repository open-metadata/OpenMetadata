/*
 *  Copyright 2026 Collate.
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
import NotificationDestinationBridge from './NotificationDestinationBridge';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock(
  '../../../../../Alerts/DestinationFormItem/DestinationFormItem.component',
  () => jest.fn(() => <div data-testid="destination-form-item" />)
);

jest.mock(
  '../../../../../Alerts/DestinationFormItem/DestinationFormItem.interface',
  () => ({})
);

describe('NotificationDestinationBridge', () => {
  const defaultProps = {
    values: {},
    onChange: jest.fn(),
  };

  it('should render DestinationFormItem', () => {
    render(<NotificationDestinationBridge {...defaultProps} />);

    expect(screen.getByTestId('destination-form-item')).toBeInTheDocument();
  });

  it('should call renderValidationField with a function', () => {
    const renderValidationField = jest.fn();

    render(
      <NotificationDestinationBridge
        {...defaultProps}
        renderValidationField={renderValidationField}
      />
    );

    expect(renderValidationField).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should provide a callable validate function to renderValidationField', () => {
    let capturedValidate: (() => Promise<void>) | undefined;
    const renderValidationField = jest.fn((validate) => {
      capturedValidate = validate;

      return null;
    });

    render(
      <NotificationDestinationBridge
        {...defaultProps}
        renderValidationField={renderValidationField}
      />
    );

    expect(capturedValidate).toBeDefined();
    expect(typeof capturedValidate).toBe('function');
  });
});
