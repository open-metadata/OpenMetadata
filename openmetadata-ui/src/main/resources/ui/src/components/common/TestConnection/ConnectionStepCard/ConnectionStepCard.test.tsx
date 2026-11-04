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
import { fireEvent, render, screen } from '@testing-library/react';
import ConnectionStepCard from './ConnectionStepCard';

const mockCopy = jest.fn();

jest.mock('@melloware/react-logviewer', () => ({
  LazyLog: ({ text }: { text: string }) => <pre data-testid="log">{text}</pre>,
}));

jest.mock('../../../../hooks/useClipBoard', () => ({
  useClipboard: () => ({ onCopyToClipBoard: mockCopy }),
}));

const step = { name: 'CheckAccess', mandatory: true, description: 'desc' };

describe('ConnectionStepCard', () => {
  it('shows the failed badge and toggles the error log', () => {
    render(
      <ConnectionStepCard
        isTestingConnection={false}
        testConnectionStep={step}
        testConnectionStepResult={{
          name: 'CheckAccess',
          mandatory: true,
          passed: false,
          message: 'denied',
          errorLog: 'stack trace',
        }}
      />
    );

    expect(screen.getByTestId('fail-badge')).toBeInTheDocument();
    expect(screen.getByText('denied')).toBeInTheDocument();
    expect(screen.getByTestId('log')).not.toBeVisible();

    fireEvent.click(screen.getByText('label.show-log-plural'));

    expect(screen.getByTestId('log')).toBeVisible();

    fireEvent.click(screen.getByTestId('query-entity-copy-button'));

    expect(mockCopy).toHaveBeenCalled();
    expect(screen.getByTestId('log')).toBeVisible();
  });

  it('shows the success badge without a log section', () => {
    render(
      <ConnectionStepCard
        isTestingConnection={false}
        testConnectionStep={step}
        testConnectionStepResult={{
          name: 'CheckAccess',
          mandatory: true,
          passed: true,
        }}
      />
    );

    expect(screen.getByTestId('success-badge')).toBeInTheDocument();
    expect(screen.queryByTestId('lazy-log')).not.toBeInTheDocument();
  });
});
