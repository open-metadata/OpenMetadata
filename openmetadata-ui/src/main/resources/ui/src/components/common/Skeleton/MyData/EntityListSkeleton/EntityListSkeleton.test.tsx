/*
 *  Copyright 2024 Collate.
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
// EntityListSkeleton.test.js

import { act, render, screen } from '@testing-library/react';
import EntityListSkeleton from './EntityListSkeleton.component';

const mockDataLength = 5;
jest.mock(
  '../../CommonSkeletons/LabelCountSkeleton/LabelCountSkeleton.component',
  () => {
    return jest
      .fn()
      .mockImplementation(({ children }) => (
        <div data-testid="label-count-skeleton">{children}</div>
      ));
  }
);

describe('EntityListSkeleton', () => {
  it('should render skeleton items when loading', async () => {
    await act(async () => {
      render(
        <EntityListSkeleton loading dataLength={mockDataLength}>
          <div>Actual content goes here</div>
        </EntityListSkeleton>
      );
    });

    const skeletonItems = screen.getAllByTestId('label-count-skeleton');

    expect(
      await screen.findByTestId('entity-list-skeleton')
    ).toBeInTheDocument();
    expect(skeletonItems).toHaveLength(mockDataLength);
  });

  it('should render children when not loading', async () => {
    await act(async () => {
      render(
        <EntityListSkeleton dataLength={mockDataLength} loading={false}>
          <div>Actual content goes here</div>
        </EntityListSkeleton>
      );
    });

    expect(screen.getByText('Actual content goes here')).toBeInTheDocument();
  });

  it('should not display count label skeleton when dataLength is 0', async () => {
    await act(async () => {
      render(
        <EntityListSkeleton loading dataLength={0}>
          <div>Actual content goes here</div>
        </EntityListSkeleton>
      );
    });

    expect(screen.queryByTestId('label-count-skeleton')).toBeNull();
  });
});
