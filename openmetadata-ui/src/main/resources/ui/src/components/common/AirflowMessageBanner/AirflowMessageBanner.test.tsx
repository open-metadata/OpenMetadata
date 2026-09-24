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
import { AIRFLOW_HYBRID, DISABLED } from '../../../constants/constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import AirflowMessageBanner from './AirflowMessageBanner';

// The real previewer parses markdown asynchronously and renders nothing in jsdom, so the message
// itself is only assertable through the prop.
jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => (
    <div data-testid="viewer-container">{markdown}</div>
  ),
}));

jest.mock(
  '../../../context/AirflowStatusProvider/AirflowStatusProvider',
  () => ({
    useAirflowStatus: jest.fn().mockImplementation(() => ({
      reason: 'reason message',
      isAirflowAvailable: false,
      isFetchingStatus: false,
      platform: 'unknown',
    })),
  })
);

describe('Test Airflow Message Banner', () => {
  it('Should render the banner if airflow is not available', () => {
    render(<AirflowMessageBanner />);

    expect(screen.getByTestId('no-airflow-placeholder')).toBeInTheDocument();
  });

  it('Should not render the banner if airflow is available and platform is not hybrid', () => {
    (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
      reason: 'reason message',
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: 'unknown',
    }));
    render(<AirflowMessageBanner />);

    expect(
      screen.queryByTestId('no-airflow-placeholder')
    ).not.toBeInTheDocument();
  });

  describe('Hybrid Runner Scenarios', () => {
    it('Should render the banner for hybrid runner even when platform is available (status 200)', () => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
        reason: 'Hybrid runner is configured correctly',
        isAirflowAvailable: true,
        isFetchingStatus: false,
        platform: AIRFLOW_HYBRID,
      }));
      render(<AirflowMessageBanner />);

      expect(screen.getByTestId('no-airflow-placeholder')).toBeInTheDocument();
      expect(screen.getByTestId('viewer-container')).toBeInTheDocument();
    });

    it('Should render the banner for hybrid runner when platform is not available', () => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
        reason: 'Hybrid runner configuration error',
        isAirflowAvailable: false,
        isFetchingStatus: false,
        platform: AIRFLOW_HYBRID,
      }));
      render(<AirflowMessageBanner />);

      expect(screen.getByTestId('no-airflow-placeholder')).toBeInTheDocument();
      expect(screen.getByTestId('viewer-container')).toBeInTheDocument();
    });

    it('Should not render the banner for hybrid runner if reason is empty', () => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
        reason: '',
        isAirflowAvailable: true,
        isFetchingStatus: false,
        platform: AIRFLOW_HYBRID,
      }));
      render(<AirflowMessageBanner />);

      expect(
        screen.queryByTestId('no-airflow-placeholder')
      ).not.toBeInTheDocument();
    });
  });

  describe('Disabled Pipeline Client Scenarios', () => {
    // The status call answers 200 for a client that is switched off in the configuration, so none
    // of the cases above catch it and the banner said nothing while deploy, run and kill all
    // quietly did nothing.
    const disabledStatus = {
      reason: 'Pipeline Client Disabled',
      isAirflowAvailable: true,
      isFetchingStatus: false,
      platform: DISABLED,
    };

    it('Should render the caller message when the pipeline client is disabled', () => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(
        () => disabledStatus
      );
      render(
        <AirflowMessageBanner disabledFallbackMessage="agents cannot be run" />
      );

      expect(screen.getByTestId('no-airflow-placeholder')).toBeInTheDocument();
      expect(screen.getByText('agents cannot be run')).toBeInTheDocument();
    });

    it('Should prefer the caller message over the untranslated server reason', () => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(
        () => disabledStatus
      );
      render(
        <AirflowMessageBanner
          disabledFallbackMessage="agents cannot be run"
          unreachableFallbackMessage="agents keep listing"
        />
      );

      expect(
        screen.queryByText('Pipeline Client Disabled')
      ).not.toBeInTheDocument();
      expect(screen.queryByText('agents keep listing')).not.toBeInTheDocument();
    });

    it('Should render nothing when no disabled message was supplied', () => {
      // Shared with the connection setup and success screens, which have nothing on screen that a
      // disabled-client message would explain.
      (useAirflowStatus as jest.Mock).mockImplementationOnce(
        () => disabledStatus
      );
      render(<AirflowMessageBanner />);

      expect(
        screen.queryByTestId('no-airflow-placeholder')
      ).not.toBeInTheDocument();
    });
  });

  describe('Common Scenarios', () => {
    it('Should not render the banner if fetching status', () => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
        reason: 'reason message',
        isAirflowAvailable: false,
        isFetchingStatus: true,
        platform: 'unknown',
      }));
      render(<AirflowMessageBanner />);

      expect(
        screen.queryByTestId('no-airflow-placeholder')
      ).not.toBeInTheDocument();
    });

    it.each([
      ['empty', ''],
      ['null', null],
    ])('Should use the caller fallback when reason is %s', (_label, reason) => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
        reason,
        isAirflowAvailable: false,
        isFetchingStatus: false,
        platform: 'unknown',
      }));
      render(
        <AirflowMessageBanner unreachableFallbackMessage="agents keep listing" />
      );

      expect(screen.getByTestId('no-airflow-placeholder')).toBeInTheDocument();
      expect(screen.getByText('agents keep listing')).toBeInTheDocument();
    });

    it.each([
      ['empty', ''],
      ['null', null],
    ])(
      'Should render nothing when reason is %s and no fallback was supplied',
      (_label, reason) => {
        // Shared with the connection setup and success screens, which have nothing on screen that
        // an unreachable-service message would explain.
        (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
          reason,
          isAirflowAvailable: false,
          isFetchingStatus: false,
          platform: 'unknown',
        }));
        render(<AirflowMessageBanner />);

        expect(
          screen.queryByTestId('no-airflow-placeholder')
        ).not.toBeInTheDocument();
      }
    );

    it('Should render the banner if platform is not available and reason is not empty', () => {
      (useAirflowStatus as jest.Mock).mockImplementationOnce(() => ({
        reason: 'Some error occurred',
        isAirflowAvailable: false,
        isFetchingStatus: false,
        platform: 'unknown',
      }));
      render(<AirflowMessageBanner />);

      expect(
        screen.queryByTestId('no-airflow-placeholder')
      ).toBeInTheDocument();
    });
  });
});
