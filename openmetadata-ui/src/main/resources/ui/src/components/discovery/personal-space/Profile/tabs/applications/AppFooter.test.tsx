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
import { AppFooter, AppFooterSlotContext } from './AppFooter';

describe('AppFooter', () => {
  it('renders inline when no footer slot is provided', () => {
    const { container } = render(
      <AppFooter testId="footer">
        <button>Save</button>
      </AppFooter>
    );

    expect(container).toContainElement(screen.getByTestId('footer'));
  });

  it('renders into the panel footer slot when one is provided', () => {
    const slot = document.createElement('div');
    document.body.appendChild(slot);

    const { container } = render(
      <AppFooterSlotContext.Provider value={slot}>
        <AppFooter testId="footer">
          <button>Save</button>
        </AppFooter>
      </AppFooterSlotContext.Provider>
    );

    expect(slot).toContainElement(screen.getByTestId('footer'));
    expect(container).not.toContainElement(screen.getByTestId('footer'));

    slot.remove();
  });
});
