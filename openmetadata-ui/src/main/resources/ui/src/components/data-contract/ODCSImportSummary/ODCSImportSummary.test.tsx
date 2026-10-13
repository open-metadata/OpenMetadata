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
import {
  MOCK_BLOCKED_IMPORT_REPORT,
  MOCK_IMPORT_REPORT,
} from '../ODCSImportReport/ODCSImportReport.mock';
import ODCSImportSummary from './ODCSImportSummary';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
}));

describe('ODCSImportSummary', () => {
  it('says a document with warnings can still be imported', () => {
    render(<ODCSImportSummary report={MOCK_IMPORT_REPORT} />);

    expect(screen.getByText('label.ready-with-warnings')).toBeInTheDocument();
    expect(screen.getByTestId('odcs-summary-blocking')).toHaveTextContent('0');
    expect(screen.getByTestId('odcs-summary-not-imported')).toHaveTextContent(
      '2'
    );
  });

  it('counts the quality rules that run as test cases', () => {
    render(<ODCSImportSummary report={MOCK_IMPORT_REPORT} />);

    expect(screen.getByTestId('odcs-summary-quality-rules')).toHaveTextContent(
      'message.quality-rules-run-summary:{"testCases":1,"total":3}'
    );
  });

  it('says a blocked document cannot be imported', () => {
    render(<ODCSImportSummary report={MOCK_BLOCKED_IMPORT_REPORT} />);

    expect(screen.getByText('label.cannot-import')).toBeInTheDocument();
    expect(screen.getByTestId('odcs-summary-blocking')).toHaveTextContent('1');
  });
});
