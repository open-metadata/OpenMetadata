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
import type { ElementType, ReactNode } from 'react';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import MarketplaceGreetingBanner from './MarketplaceGreetingBanner.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { name?: string }) => {
      if (key === 'label.hey-comma-name') {
        return `Hey, ${options?.name}`;
      }

      return key;
    },
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Typography: ({
    as: Element = 'div',
    children,
    ...props
  }: {
    as?: ElementType;
    children: ReactNode;
  }) => <Element {...props}>{children}</Element>,
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;

describe('MarketplaceGreetingBanner', () => {
  it('renders greeting displayName in start case', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { displayName: 'john_doe' },
    });

    render(<MarketplaceGreetingBanner />);

    expect(screen.getByTestId('greeting-text')).toHaveTextContent(
      'Hey, John Doe'
    );
  });

  it('falls back to start-cased username when displayName is not present', () => {
    mockUseApplicationStore.mockReturnValue({
      currentUser: { name: 'jane_smith' },
    });

    render(<MarketplaceGreetingBanner />);

    expect(screen.getByTestId('greeting-text')).toHaveTextContent(
      'Hey, Jane Smith'
    );
  });
});
