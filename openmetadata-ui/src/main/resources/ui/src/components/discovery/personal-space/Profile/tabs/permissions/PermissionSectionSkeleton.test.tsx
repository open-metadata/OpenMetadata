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
import { ReactNode } from 'react';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  Skeleton: () => <div data-testid="skeleton" />,
}));

import PermissionSectionSkeleton from './PermissionSectionSkeleton';

describe('PermissionSectionSkeleton', () => {
  it('renders two skeleton blocks per card by default', () => {
    render(<PermissionSectionSkeleton />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(2);
  });

  it('renders the requested number of placeholder cards', () => {
    render(<PermissionSectionSkeleton rows={3} />);

    expect(screen.getAllByTestId('skeleton')).toHaveLength(6);
  });
});
