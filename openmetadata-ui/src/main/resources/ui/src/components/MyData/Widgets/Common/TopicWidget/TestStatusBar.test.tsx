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
import TestStatusBar from './TestStatusBar';

jest.mock('@openmetadata/ui-core-components/charts', () => ({
  BarChart: () => <div data-testid="bar-chart" />,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('TestStatusBar', () => {
  it('renders nothing when no test has run', () => {
    const { container } = render(
      <TestStatusBar aborted={0} failed={0} passed={0} total={0} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  // The legend used to be one `${name} ${count}` string — a word order fixed
  // in English. Name and figure are now two nodes a locale never has to merge.
  it('keeps each legend label and its count as separate nodes', () => {
    render(<TestStatusBar aborted={1} failed={4} passed={20} total={25} />);

    const failed = screen.getByTestId('test-status-failed');

    expect(failed).toHaveTextContent('label.failed');
    expect(screen.getByTestId('test-status-failed-count')).toHaveTextContent(
      /^4$/
    );
    expect(screen.getByTestId('test-status-passed-count')).toHaveTextContent(
      /^20$/
    );
    expect(screen.getByTestId('test-status-aborted-count')).toHaveTextContent(
      /^1$/
    );
  });
});
