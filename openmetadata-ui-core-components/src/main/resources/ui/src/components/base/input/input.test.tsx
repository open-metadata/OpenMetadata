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
import { createRef } from 'react';
import { describe, expect, it } from 'vitest';
import { Input } from './input';
import { PasswordInput } from './password-input';

describe('Input', () => {
  it('greys the input text when the field is disabled', () => {
    render(<Input isDisabled label="Service name" value="mysql_sample" />);

    expect(screen.getByRole('textbox', { name: /Service name/ })).toHaveClass(
      'tw:text-disabled'
    );
  });

  it('marks an invalid field on the input and shows the invalid icon', () => {
    const { container } = render(<Input isInvalid label="Display name" />);

    expect(
      screen.getByRole('textbox', { name: /Display name/ })
    ).toHaveAttribute('aria-invalid', 'true');
    expect(
      container.querySelector('.tw\\:text-fg-error-secondary')
    ).not.toBeNull();
  });

  it('keeps the help tooltip beside the invalid icon', () => {
    const { container } = render(
      <Input isInvalid label="Display name" tooltip="Shown to every user" />
    );

    const errorIcon = container.querySelector('.tw\\:text-fg-error-secondary');
    const helpTrigger = container.querySelector('.tw\\:right-9');

    expect(errorIcon).not.toBeNull();
    expect(helpTrigger).not.toBeNull();
    expect(helpTrigger?.querySelector('svg')).not.toBeNull();
    expect(screen.getByRole('textbox', { name: /Display name/ })).toHaveClass(
      'tw:pr-15'
    );
  });

  it('forwards its ref to the native input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Display name" ref={ref} />);

    expect(ref.current).toBe(
      screen.getByRole('textbox', { name: /Display name/ })
    );
  });
});

describe('PasswordInput', () => {
  it('forwards its ref to the native input', () => {
    const ref = createRef<HTMLInputElement>();
    render(<PasswordInput label="Password" ref={ref} />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
    expect(ref.current).toHaveAttribute('type', 'password');
  });
});
