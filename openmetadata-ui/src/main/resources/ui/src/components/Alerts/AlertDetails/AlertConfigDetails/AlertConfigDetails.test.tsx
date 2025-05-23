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

import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { mockAlertDetails } from '../../../../mocks/Alerts.mock';
import { MOCK_FILTER_RESOURCES } from '../../../../test/unit/mocks/observability.mock';
import AlertConfigDetails from './AlertConfigDetails';

jest.mock('../../../../rest/observabilityAPI', () => ({
  getResourceFunctions: jest.fn().mockImplementation(() => ({
    data: MOCK_FILTER_RESOURCES,
  })),
}));

jest.mock('../../../../rest/alertsAPI', () => ({
  getResourceFunctions: jest.fn().mockImplementation(() => ({
    data: MOCK_FILTER_RESOURCES,
  })),
}));

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Loader</div>)
);

jest.mock('../../AlertFormSourceItem/AlertFormSourceItem', () =>
  jest.fn().mockImplementation(() => <div>AlertFormSourceItem</div>)
);

jest.mock(
  '../../ObservabilityFormFiltersItem/ObservabilityFormFiltersItem',
  () =>
    jest.fn().mockImplementation(() => <div>ObservabilityFormFiltersItem</div>)
);

jest.mock(
  '../../ObservabilityFormTriggerItem/ObservabilityFormTriggerItem',
  () =>
    jest.fn().mockImplementation(() => <div>ObservabilityFormTriggerItem</div>)
);

jest.mock('../../DestinationFormItem/DestinationFormItem.component', () =>
  jest.fn().mockImplementation(() => <div>DestinationFormItem</div>)
);

describe('AlertConfigDetails', () => {
  it('should render the component', async () => {
    await act(async () => {
      render(
        <AlertConfigDetails
          alertDetails={mockAlertDetails}
          isNotificationAlert={false}
        />
      );
    });

    expect(screen.getByText('AlertFormSourceItem')).toBeInTheDocument();
    expect(screen.getByText('DestinationFormItem')).toBeInTheDocument();
  });

  it('should render ObservabilityFormFiltersItem when filters are present', async () => {
    const alertDetailsWithFilters = {
      ...mockAlertDetails,
      input: { filters: [{ name: 'filter1' }] },
    };
    await act(async () => {
      render(
        <AlertConfigDetails
          alertDetails={alertDetailsWithFilters}
          isNotificationAlert={false}
        />
      );
    });

    expect(
      screen.getByText('ObservabilityFormFiltersItem')
    ).toBeInTheDocument();
  });

  it('should render ObservabilityFormTriggerItem when actions are present', async () => {
    const alertDetailsWithActions = {
      ...mockAlertDetails,
      input: { actions: [{ name: 'action1' }] },
    };
    await act(async () => {
      render(
        <AlertConfigDetails
          alertDetails={alertDetailsWithActions}
          isNotificationAlert={false}
        />
      );
    });

    expect(
      screen.getByText('ObservabilityFormTriggerItem')
    ).toBeInTheDocument();
  });

  it('should show loader when fetching data', async () => {
    jest.spyOn(React, 'useState').mockImplementationOnce(() => [1, jest.fn()]);
    render(
      <AlertConfigDetails
        alertDetails={mockAlertDetails}
        isNotificationAlert={false}
      />
    );

    expect(screen.getByText('Loader')).toBeInTheDocument();
  });
});
