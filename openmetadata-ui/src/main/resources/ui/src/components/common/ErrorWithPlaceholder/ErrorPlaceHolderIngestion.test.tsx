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
import * as reactI18next from 'react-i18next';
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

jest.mock('../../../utils/BrandData/BrandClassBase', () => ({
  __esModule: true,
  default: {
    getPageTitle: jest.fn().mockReturnValue('OpenMetadata'),
  },
}));

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

  it('should render with correct brandName (OpenMetadata or Collate) for Airflow platform', async () => {
    const mockT = jest.fn((key: string, params?: Record<string, string>) => {
      if (key === 'message.manage-airflow-api-failed' && params?.brandName) {
        return `Failed to find ${params.brandName} - Managed Airflow APIs`;
      }
      if (key === 'message.airflow-guide-message' && params?.brandName) {
        return (
          `${params.brandName} uses Airflow to run Ingestion Connectors. ` +
          `We developed Managed APIs to deploy ingestion connectors. ` +
          `Please use ${params.brandName} Airflow instance or refer to ` +
          `the guide below to install the managed APIs in your Airflow installation.`
        );
      }

      return key;
    });

    jest.spyOn(reactI18next, 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { language: 'en-US' },
      ready: true,
    } as any);

    (useAirflowStatus as jest.Mock).mockReturnValue({
      platform: PIPELINE_SERVICE_PLATFORM,
      isFetchingStatus: false,
    });

    await act(async () => {
      render(<ErrorPlaceHolderIngestion />);
    });

    const errorSteps = screen.getByTestId('error-steps');

    expect(errorSteps).toBeInTheDocument();
    // Verify actual brand name is rendered
    expect(errorSteps.textContent).toMatch(/OpenMetadata|Collate/);
    expect(errorSteps.textContent).not.toContain('{{brandName}}');

    // Verify translation was called with brandName
    expect(mockT).toHaveBeenCalledWith('message.manage-airflow-api-failed', {
      brandName: 'OpenMetadata',
    });
    expect(mockT).toHaveBeenCalledWith('message.airflow-guide-message', {
      brandName: 'OpenMetadata',
    });
  });

  it('should render with correct brandName (OpenMetadata or Collate) for non-Airflow platform', async () => {
    const mockT = jest.fn((key: string, params?: Record<string, string>) => {
      if (key === 'message.pipeline-scheduler-message' && params?.brandName) {
        return `The Ingestion Scheduler is unable to respond. Please reach out to ${params.brandName} support. Thank you.`;
      }

      return key;
    });

    jest.spyOn(reactI18next, 'useTranslation').mockReturnValue({
      t: mockT,
      i18n: { language: 'en-US' },
      ready: true,
    } as any);

    (useAirflowStatus as jest.Mock).mockReturnValue({
      platform: 'Argo',
      isFetchingStatus: false,
    });

    await act(async () => {
      render(<ErrorPlaceHolderIngestion />);
    });

    const errorSteps = screen.getByTestId('error-steps');

    expect(errorSteps).toBeInTheDocument();
    // Verify actual brand name is rendered
    expect(errorSteps.textContent).toMatch(/OpenMetadata|Collate/);
    expect(errorSteps.textContent).not.toContain('{{brandName}}');

    // Verify translation was called with brandName
    expect(mockT).toHaveBeenCalledWith('message.pipeline-scheduler-message', {
      brandName: 'OpenMetadata',
    });
  });
});
