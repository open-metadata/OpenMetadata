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
import { render, screen, within } from '@testing-library/react';
import ODCSImportReport from './ODCSImportReport';
import {
  MOCK_BLOCKED_IMPORT_REPORT,
  MOCK_IMPORT_REPORT,
} from './ODCSImportReport.mock';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count === undefined ? key : `${key}:${options.count}`,
  }),
}));

describe('ODCSImportReport', () => {
  it('lists what each quality rule becomes', () => {
    render(<ODCSImportReport report={MOCK_IMPORT_REPORT} />);

    const rules = screen.getByTestId('odcs-report-quality-rules');

    expect(within(rules).getByText('Row count range')).toBeInTheDocument();
    expect(
      within(rules).getByText('tableRowCountToBeBetween · odcs_row_count_range')
    ).toBeInTheDocument();
    expect(within(rules).getByText('label.test-case')).toBeInTheDocument();
    expect(within(rules).getByText('label.sla')).toBeInTheDocument();
    expect(within(rules).getByText('label.not-run')).toBeInTheDocument();
  });

  it('groups what is not imported by section and shows how often it occurs', () => {
    render(<ODCSImportReport report={MOCK_IMPORT_REPORT} />);

    expect(
      screen.getByTestId('odcs-report-not-imported-schema')
    ).toHaveTextContent('`businessName` is not imported.');
    expect(
      screen.getByTestId('odcs-report-not-imported-servers')
    ).toHaveTextContent('`servers` is not imported.');
    expect(screen.getByText('label.occurrence-count:25')).toBeInTheDocument();
  });

  it('lists fields kept only for export separately', () => {
    render(<ODCSImportReport report={MOCK_IMPORT_REPORT} />);

    expect(screen.getByTestId('odcs-report-info')).toHaveTextContent(
      '`authoritativeDefinitions` is kept for ODCS export'
    );
  });

  it('opens the quality rules when nothing blocks the import', () => {
    render(<ODCSImportReport report={MOCK_IMPORT_REPORT} />);

    expect(screen.queryByTestId('odcs-report-blocking-issues')).toBeNull();
    expect(
      screen.getByRole('button', { name: /label.quality-rule-plural/ })
    ).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens the blocking issues first when the import is blocked', () => {
    render(<ODCSImportReport report={MOCK_BLOCKED_IMPORT_REPORT} />);

    expect(
      screen.getByRole('button', { name: /label.blocking-issue-plural/ })
    ).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('odcs-report-blocking-issues')).toHaveTextContent(
      'Column `e_mail` is in the contract but not in the table.'
    );
  });
});
