/*
 *  Copyright 2022 Collate.
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
import { getJWTTokenExpiryOptions } from './BotsUtils';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Select: {
    Option: ({ children }: { children: React.ReactNode }) => {
      return <div className="ant-select-option">{children}</div>;
    },
  },
}));

describe('getJWTTokenExpiryOptions', () => {
  it('should return all JWT token expiry options when filterUnlimited is false (default)', () => {
    const result = getJWTTokenExpiryOptions();
    render(<>{result}</>);

    // Check for specific options (using the actual translation keys from global mock)
    expect(screen.getByText('label.1-hr')).toBeInTheDocument();
    expect(screen.getByText('label.1-day')).toBeInTheDocument();
    expect(screen.getAllByText('label.number-day-plural')).toHaveLength(4);
    expect(screen.getByText('label.unlimited')).toBeInTheDocument();
  });

  it('should return all JWT token expiry options when filterUnlimited is explicitly false', () => {
    const result = getJWTTokenExpiryOptions(false);
    const { container } = render(<>{result}</>);

    // Should contain all 7 options including Unlimited
    expect(container.querySelectorAll('.ant-select-option')).toHaveLength(7);
    expect(container.textContent).toContain('label.unlimited');
  });

  it('should filter out Unlimited option when filterUnlimited is true', () => {
    const result = getJWTTokenExpiryOptions(true);
    const { container } = render(<>{result}</>);

    // Should contain only 6 options (excluding Unlimited)
    expect(container.querySelectorAll('.ant-select-option')).toHaveLength(6);

    // Check for specific options (using the actual translation keys from global mock)
    expect(container.textContent).toContain('label.1-hr');
    expect(container.textContent).toContain('label.1-day');
    expect(container.textContent).toContain('label.number-day-plural');
    expect(container.textContent).toContain('label.number-day-plural');
    expect(container.textContent).toContain('label.number-day-plural');
    expect(container.textContent).toContain('label.number-day-plural');

    // Should NOT contain Unlimited
    expect(container.textContent).not.toContain('label.unlimited');
  });

  it('should return Option components with correct key and content', () => {
    const result = getJWTTokenExpiryOptions();
    const { container } = render(<>{result}</>);

    const options = container.querySelectorAll('.ant-select-option');

    // Check that each option has the correct structure
    options.forEach((option) => {
      expect(option).toBeInTheDocument();
      expect(option.tagName).toBe('DIV');
    });

    // Check first option specifically (using actual translation keys)
    expect(options[0].textContent).toBe('label.1-hr');
    expect(options[1].textContent).toBe('label.1-day');
    expect(options[2].textContent).toBe('label.number-day-plural');
    expect(options[3].textContent).toBe('label.number-day-plural');
    expect(options[4].textContent).toBe('label.number-day-plural');
    expect(options[5].textContent).toBe('label.number-day-plural');
    expect(options[6].textContent).toBe('label.unlimited');
  });

  it('should maintain correct order of options', () => {
    const result = getJWTTokenExpiryOptions();
    const { container } = render(<>{result}</>);

    const options = container.querySelectorAll('.ant-select-option');
    const optionTexts = Array.from(options).map((option) => option.textContent);

    // Check the order matches the expected order (using actual translation keys)
    expect(optionTexts).toEqual([
      'label.1-hr',
      'label.1-day',
      'label.number-day-plural',
      'label.number-day-plural',
      'label.number-day-plural',
      'label.number-day-plural',
      'label.unlimited',
    ]);
  });
});
