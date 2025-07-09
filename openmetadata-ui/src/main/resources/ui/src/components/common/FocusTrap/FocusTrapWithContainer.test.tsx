/*
 *  Copyright 2025 Collate.
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
/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  You may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { render } from '@testing-library/react';
import { FocusTrapWithContainer } from './FocusTrapWithContainer';

jest.mock('focus-trap-react', () => ({
  FocusTrap: ({ children, focusTrapOptions }: any) => (
    <div
      data-options={JSON.stringify(!!focusTrapOptions)}
      data-testid="focus-trap-mock">
      {children}
    </div>
  ),
}));

describe('FocusTrapWithContainer', () => {
  it('renders children inside FocusTrap', () => {
    const { getByText, getByTestId } = render(
      <FocusTrapWithContainer>
        <button>Test Button</button>
      </FocusTrapWithContainer>
    );

    expect(getByTestId('focus-trap-mock')).toBeInTheDocument();
    expect(getByText('Test Button')).toBeInTheDocument();
  });

  it('passes focusTrapOptions to FocusTrap', () => {
    const { getByTestId } = render(
      <FocusTrapWithContainer>
        <span>Child</span>
      </FocusTrapWithContainer>
    );

    // The mock sets data-options to true if focusTrapOptions is present
    expect(getByTestId('focus-trap-mock').getAttribute('data-options')).toBe(
      'true'
    );
  });
});
