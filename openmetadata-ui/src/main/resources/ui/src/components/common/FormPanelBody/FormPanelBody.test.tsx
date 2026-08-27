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
import FormPanelBody, {
  getFormFirstPanelProps,
} from './FormPanelBody.component';

describe('FormPanelBody', () => {
  it('should render the content and omit the footer row when no footer is given', () => {
    const { container } = render(
      <FormPanelBody>
        <p>form content</p>
      </FormPanelBody>
    );

    expect(screen.getByText('form content')).toBeInTheDocument();
    expect(container.querySelectorAll('.tw\\:py-4')).toHaveLength(0);
  });

  it('should render the footer inside its own row when given', () => {
    const { container } = render(
      <FormPanelBody footer={<button type="button">Next</button>}>
        <p>form content</p>
      </FormPanelBody>
    );

    const footerRow = container.querySelector('.tw\\:py-4');

    expect(footerRow).toBeInTheDocument();
    expect(footerRow?.className).toContain('tw:flex-shrink-0');
    expect(footerRow).toContainElement(screen.getByRole('button'));
  });

  it('should not own the vertical scroll', () => {
    // The rail this sits in limits its width and centres it, so a scroll port here leaves the blank
    // margins beside the form unscrollable. The full-width panel above owns scrolling instead.
    const { container } = render(
      <FormPanelBody>
        <p>form content</p>
      </FormPanelBody>
    );

    const body = container.firstElementChild as HTMLElement;

    expect(body.className).toContain('tw:min-h-full');
    expect(body.className).not.toContain('tw:overflow-y-scroll');
    expect(body.className).not.toContain('tw:overflow-y-auto');
    expect(body.className).not.toContain('tw:h-full');
  });
});

describe('getFormFirstPanelProps', () => {
  it('should hand scrolling to the panel so the centring margins stay scrollable', () => {
    const panel = getFormFirstPanelProps(<p>form content</p>);

    expect(panel.allowScroll).toBe(true);
    expect(panel.wrapInCard).toBe(false);
    expect(panel.className).toContain('no-scrollbar');
  });
});
