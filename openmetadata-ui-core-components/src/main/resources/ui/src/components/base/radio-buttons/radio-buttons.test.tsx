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
import { describe, expect, it, vi } from 'vitest';
import { Label } from '@/components/base/input/label';
import { RadioButton, RadioGroup } from './radio-buttons';

const NO_LABEL_WARNING =
  'If you do not provide a visible label, you must specify an aria-label or aria-labelledby attribute for accessibility';

const captureWarnings = () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

  return {
    get messages() {
      return warn.mock.calls.map((call) => String(call[0]));
    },
    restore: () => warn.mockRestore(),
  };
};

describe('RadioGroup label prop', () => {
  it('renders the label prop as visible text and the group accessible name', () => {
    const { container } = render(
      <RadioGroup defaultValue="pro" label="Pricing plan">
        <RadioButton label="Pro" value="pro" />
      </RadioGroup>
    );

    expect(screen.getByText('Pricing plan')).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: /Pricing plan/ })
    ).toBeInTheDocument();

    const radiogroup = container.querySelector(
      '[role="radiogroup"]'
    ) as HTMLElement;

    expect(radiogroup.getAttribute('aria-labelledby')).toBeTruthy();
    expect(radiogroup.getAttribute('aria-label')).toBeNull();
  });

  it('does not emit the react-aria useLabel warning when a label is provided', () => {
    const warnings = captureWarnings();

    render(
      <RadioGroup defaultValue="pro" label="Pricing plan">
        <RadioButton label="Pro" value="pro" />
      </RadioGroup>
    );

    expect(warnings.messages).not.toContain(NO_LABEL_WARNING);
    warnings.restore();
  });

  it('still warns when no label, aria-label, or aria-labelledby is provided', () => {
    const warnings = captureWarnings();

    render(
      <RadioGroup defaultValue="pro">
        <RadioButton label="Pro" value="pro" />
      </RadioGroup>
    );

    expect(warnings.messages).toContain(NO_LABEL_WARNING);
    warnings.restore();
  });

  it('honours a caller-provided aria-label without rendering extra visible text', () => {
    const warnings = captureWarnings();

    const { container } = render(
      <RadioGroup aria-label="Tier" defaultValue="pro">
        <RadioButton label="Pro" value="pro" />
      </RadioGroup>
    );

    expect(
      screen.getByRole('radiogroup', { name: 'Tier' })
    ).toBeInTheDocument();
    expect(screen.queryByText('Tier')).toBeNull();

    const radiogroup = container.querySelector(
      '[role="radiogroup"]'
    ) as HTMLElement;

    expect(radiogroup.getAttribute('aria-label')).toBe('Tier');
    expect(radiogroup.getAttribute('aria-labelledby')).toBeNull();
    expect(warnings.messages).not.toContain(NO_LABEL_WARNING);
    warnings.restore();
  });

  it('supports a slotted Label child when the label prop is omitted', () => {
    const warnings = captureWarnings();

    render(
      <RadioGroup defaultValue="pro">
        <Label>HTTP method</Label>
        <RadioButton label="Pro" value="pro" />
      </RadioGroup>
    );

    expect(screen.getByText('HTTP method')).toBeInTheDocument();
    expect(
      screen.getByRole('radiogroup', { name: /HTTP method/ })
    ).toBeInTheDocument();
    expect(warnings.messages).not.toContain(NO_LABEL_WARNING);
    warnings.restore();
  });
});
