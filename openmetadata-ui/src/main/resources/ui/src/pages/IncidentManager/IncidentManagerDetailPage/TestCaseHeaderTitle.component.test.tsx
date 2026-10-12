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
import TestCaseHeaderTitle from './TestCaseHeaderTitle.component';

const mockOnCopy = jest.fn().mockResolvedValue(undefined);
const DISPLAY_NAME_TEST_ID = 'entity-header-display-name';
const TECHNICAL_NAME_TEST_ID = 'entity-header-name';

describe('TestCaseHeaderTitle', () => {
  beforeEach(() => {
    mockOnCopy.mockClear();
  });

  it('renders display and technical names and invokes the copy action', () => {
    render(
      <TestCaseHeaderTitle
        displayName="Customer count check"
        hasCopied={false}
        testCaseName="customer_count_check"
        onCopy={mockOnCopy}
      />
    );

    expect(screen.getByTestId(DISPLAY_NAME_TEST_ID)).toHaveTextContent(
      'Customer count check'
    );
    expect(screen.getByTestId(DISPLAY_NAME_TEST_ID).tagName).toBe('H2');
    expect(screen.getByTestId(TECHNICAL_NAME_TEST_ID)).toHaveTextContent(
      'customer_count_check'
    );
    expect(screen.getByTestId(TECHNICAL_NAME_TEST_ID).tagName).toBe('SPAN');

    fireEvent.click(screen.getByTestId('entity-header-copy-button'));

    expect(mockOnCopy).toHaveBeenCalledTimes(1);
  });

  it('renders the technical name as the heading without a display name', () => {
    render(
      <TestCaseHeaderTitle
        displayName={undefined}
        hasCopied={false}
        testCaseName="customer_count_check"
        onCopy={mockOnCopy}
      />
    );

    expect(screen.queryByTestId(DISPLAY_NAME_TEST_ID)).not.toBeInTheDocument();
    expect(screen.getByTestId(TECHNICAL_NAME_TEST_ID)).toHaveTextContent(
      'customer_count_check'
    );
    expect(screen.getByTestId(TECHNICAL_NAME_TEST_ID).tagName).toBe('H2');
  });
});
