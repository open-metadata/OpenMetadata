/*
 *  Copyright 2022 Collate.
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
import { PIPELINE_SERVICE_PLATFORM } from '../../../constants/Services.constant';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import ErrorPlaceHolderIngestion from './ErrorPlaceHolderIngestion';

jest.mock('../AirflowMessageBanner/AirflowMessageBanner', () => {
  return jest
    .fn()
    .mockReturnValue(<div data-testid="airflow-message-banner" />);
});

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => {
    return {
      useAirflowStatus: jest.fn().mockReturnValue({
        platform: PIPELINE_SERVICE_PLATFORM,
        isFetchingStatus: false,
      }),
    };
  }
);

describe('ErrorPlaceholderIngestion', () => {
  it('should show the error steps', async () => {
    await act(async () => {
      render(<ErrorPlaceHolderIngestion />);
    });

    expect(screen.getByTestId('error-steps')).toBeInTheDocument();
  });

  it('should show the loader when fetching status', async () => {
    (useAirflowStatus as jest.Mock).mockReturnValue({
      platform: PIPELINE_SERVICE_PLATFORM,
      isFetchingStatus: true,
    });

    await act(async () => {
      render(<ErrorPlaceHolderIngestion />);
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });
});
