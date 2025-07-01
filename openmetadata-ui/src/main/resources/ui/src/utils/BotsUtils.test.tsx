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

import { render } from '@testing-library/react';
import { JWTTokenExpiry } from '../generated/entity/teams/user';
import { getJWTTokenExpiryOptions } from './BotsUtils';

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Select: {
    Option: ({ children }: { children: React.ReactNode }) => {
      return <div className="ant-select-option">{children}</div>;
    },
  },
}));

jest.mock('../constants/User.constants', () => ({
  JWT_TOKEN_EXPIRY_OPTIONS: [
    {
      label: '1 hour',
      value: JWTTokenExpiry.OneHour,
    },
    {
      label: '1 day',
      value: JWTTokenExpiry.The1,
    },
    {
      label: '7 days',
      value: JWTTokenExpiry.The7,
    },
    {
      label: '30 days',
      value: JWTTokenExpiry.The30,
    },
    {
      label: '60 days',
      value: JWTTokenExpiry.The60,
    },
    {
      label: '90 days',
      value: JWTTokenExpiry.The90,
    },
    {
      label: 'Unlimited',
      value: JWTTokenExpiry.Unlimited,
    },
  ],
}));

describe('getJWTTokenExpiryOptions', () => {
  it('should return all JWT token expiry options when filterUnlimited is false (default)', () => {
    const result = getJWTTokenExpiryOptions();
    const { container } = render(<>{result}</>);

    // Should contain all 7 options including Unlimited
    expect(container.querySelectorAll('.ant-select-option')).toHaveLength(7);

    // Check for specific options (using the actual translation keys from global mock)
    expect(container.textContent).toContain('1 hour');
    expect(container.textContent).toContain('1 day');
    expect(container.textContent).toContain('7 days');
    expect(container.textContent).toContain('30 days');
    expect(container.textContent).toContain('60 days');
    expect(container.textContent).toContain('90 days');
    expect(container.textContent).toContain('Unlimited');
  });

  it('should return all JWT token expiry options when filterUnlimited is explicitly false', () => {
    const result = getJWTTokenExpiryOptions(false);
    const { container } = render(<>{result}</>);

    // Should contain all 7 options including Unlimited
    expect(container.querySelectorAll('.ant-select-option')).toHaveLength(7);
    expect(container.textContent).toContain('Unlimited');
  });

  it('should filter out Unlimited option when filterUnlimited is true', () => {
    const result = getJWTTokenExpiryOptions(true);
    const { container } = render(<>{result}</>);

    // Should contain only 6 options (excluding Unlimited)
    expect(container.querySelectorAll('.ant-select-option')).toHaveLength(6);

    // Check for specific options (using the actual translation keys from global mock)
    expect(container.textContent).toContain('1 hour');
    expect(container.textContent).toContain('1 day');
    expect(container.textContent).toContain('7 days');
    expect(container.textContent).toContain('30 days');
    expect(container.textContent).toContain('60 days');
    expect(container.textContent).toContain('90 days');

    // Should NOT contain Unlimited
    expect(container.textContent).not.toContain('Unlimited');
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
    expect(options[0].textContent).toBe('1 hour');
    expect(options[1].textContent).toBe('1 day');
    expect(options[2].textContent).toBe('7 days');
    expect(options[3].textContent).toBe('30 days');
    expect(options[4].textContent).toBe('60 days');
    expect(options[5].textContent).toBe('90 days');
    expect(options[6].textContent).toBe('Unlimited');
  });

  it('should maintain correct order of options', () => {
    const result = getJWTTokenExpiryOptions();
    const { container } = render(<>{result}</>);

    const options = container.querySelectorAll('.ant-select-option');
    const optionTexts = Array.from(options).map((option) => option.textContent);

    // Check the order matches the expected order (using actual translation keys)
    expect(optionTexts).toEqual([
      '1 hour',
      '1 day',
      '7 days',
      '30 days',
      '60 days',
      '90 days',
      'Unlimited',
    ]);
  });
});
