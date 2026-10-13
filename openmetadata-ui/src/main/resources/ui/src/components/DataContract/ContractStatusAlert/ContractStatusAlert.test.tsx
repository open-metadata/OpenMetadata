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
import ContractStatusAlert from './ContractStatusAlert';

const SHORT_MESSAGE = 'Failed to trigger DQ validation: connection refused';
const LONG_MESSAGE = `Failed to trigger DQ validation: ${'x'.repeat(500)}`;

describe('ContractStatusAlert', () => {
  it('renders the contract result as an error banner', () => {
    render(<ContractStatusAlert message={SHORT_MESSAGE} />);

    expect(
      screen.getByTestId('contract-status-alert-message')
    ).toHaveTextContent(SHORT_MESSAGE);
  });

  it('renders nothing when there is no message', () => {
    const { container } = render(<ContractStatusAlert message="" />);

    expect(container).toBeEmptyDOMElement();
  });

  it('offers no toggle for a message short enough to read in full', () => {
    render(<ContractStatusAlert message={SHORT_MESSAGE} />);

    expect(
      screen.queryByTestId('contract-status-alert-toggle')
    ).not.toBeInTheDocument();
  });

  // A contract `result` has no server-side size limit, so an unbounded failure
  // string must stay collapsible rather than pushing the contract off-screen.
  it('collapses a long message behind a toggle and expands it again', () => {
    render(<ContractStatusAlert message={LONG_MESSAGE} />);

    const toggle = screen.getByTestId('contract-status-alert-toggle');

    expect(toggle).toHaveTextContent('label.show-less');

    fireEvent.click(toggle);

    expect(toggle).toHaveTextContent('label.show-more');

    fireEvent.click(toggle);

    expect(toggle).toHaveTextContent('label.show-less');
  });

  it('removes itself from the page once dismissed', () => {
    render(<ContractStatusAlert message={SHORT_MESSAGE} />);

    fireEvent.click(screen.getByTestId('alert-close-button'));

    expect(
      screen.queryByTestId('contract-status-alert')
    ).not.toBeInTheDocument();
  });
});
