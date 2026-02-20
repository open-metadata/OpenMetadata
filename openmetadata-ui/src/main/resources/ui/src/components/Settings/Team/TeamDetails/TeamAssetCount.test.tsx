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

jest.mock('antd', () => ({
  Skeleton: {
    Input: jest.fn().mockImplementation(() => <div data-testid="skeleton" />),
  },
  Typography: {
    Text: jest
      .fn()
      .mockImplementation(({ children, ...props }) => <span {...props}>{children}</span>),
  },
}));

import { TeamAssetCount } from './TeamAssetCount.component';

describe('TeamAssetCount', () => {
  it('renders the count when not loading', () => {
    render(<TeamAssetCount count={42} isLoading={false} />);

    expect(screen.getByTestId('asset-count')).toHaveTextContent('42');
  });

  it('renders 0 when count is null', () => {
    render(<TeamAssetCount count={null} isLoading={false} />);

    expect(screen.getByTestId('asset-count')).toHaveTextContent('0');
  });

  it('renders skeleton while loading', () => {
    render(<TeamAssetCount isLoading count={null} />);

    expect(screen.getByTestId('skeleton')).toBeInTheDocument();
    expect(screen.queryByTestId('asset-count')).not.toBeInTheDocument();
  });
});
