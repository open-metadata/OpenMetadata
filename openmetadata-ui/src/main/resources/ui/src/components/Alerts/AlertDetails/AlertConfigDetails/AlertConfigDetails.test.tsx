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
import React from 'react';
import { mockAlertDetails } from '../../../../mocks/Alerts.mock';
import AlertConfigDetails from './AlertConfigDetails';

describe('AlertConfigDetails', () => {
  it('should render source details properly', () => {
    render(<AlertConfigDetails alertDetails={mockAlertDetails} />);

    expect(screen.getByTestId('resource-name')).toHaveTextContent('Table');
  });

  it('should render filter details properly', () => {
    render(<AlertConfigDetails alertDetails={mockAlertDetails} />);

    expect(screen.getByTestId('filter-filterByEventType')).toBeInTheDocument();
    expect(
      screen.getByTestId('filter-filterByGeneralMetadataEvents')
    ).toBeInTheDocument();
    expect(screen.getByTestId('filter-filterByOwnerName')).toBeInTheDocument();
  });

  it('should render action details properly', () => {
    render(<AlertConfigDetails alertDetails={mockAlertDetails} />);

    expect(
      screen.getByTestId('filter-GetTestCaseStatusUpdates')
    ).toBeInTheDocument();
  });

  it('should render destination details properly', () => {
    render(<AlertConfigDetails alertDetails={mockAlertDetails} />);

    expect(screen.getByTestId('destination-Admins')).toBeInTheDocument();
    expect(screen.getByTestId('destination-Teams')).toBeInTheDocument();
    expect(screen.getByTestId('destination-External')).toBeInTheDocument();
  });
});
