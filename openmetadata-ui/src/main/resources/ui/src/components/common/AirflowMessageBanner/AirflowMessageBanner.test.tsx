/*
 *  Copyright 2023 Collate.
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
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import AirflowMessageBanner from './AirflowMessageBanner';

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      reason: 'reason message',
      isAirflowAvailable: false,
    })),
  })
);

describe('Test Airflow Message Banner', () => {
  it('Should render the banner if airflow is not available', () => {
    render(<AirflowMessageBanner />);

    expect(screen.getByTestId('no-airflow-placeholder')).toBeInTheDocument();
  });

  it('Should not render the banner if airflow is available', () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      reason: 'reason message',
      isAirflowAvailable: true,
    }));
    render(<AirflowMessageBanner />);

    expect(
      screen.queryByTestId('no-airflow-placeholder')
    ).not.toBeInTheDocument();
  });
});
