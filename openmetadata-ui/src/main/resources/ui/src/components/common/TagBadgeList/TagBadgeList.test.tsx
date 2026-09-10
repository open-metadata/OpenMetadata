/*
 *  Copyright 2025 Collate.
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
import { MemoryRouter } from 'react-router-dom';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import TagBadgeList from './TagBadgeList.component';

const baseMockTag: TagLabel = {
  tagFQN: 'PII.Sensitive',
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
  name: 'Sensitive',
  displayName: 'Sensitive',
};

describe('TagBadgeList', () => {
  it('should render no data placeholder when tags array is empty', () => {
    render(
      <MemoryRouter>
        <TagBadgeList tags={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders a custom emptyPlaceholder when provided and tags are empty', () => {
    render(
      <MemoryRouter>
        <TagBadgeList emptyPlaceholder="--" tags={[]} />
      </MemoryRouter>
    );

    expect(screen.getByText('--')).toBeInTheDocument();
  });

  it('should show +N count when multiple tags exist', () => {
    const tags = [
      baseMockTag,
      { ...baseMockTag, tagFQN: 'PII.NonSensitive', name: 'NonSensitive' },
      { ...baseMockTag, tagFQN: 'PII.Other', name: 'Other' },
    ];

    render(
      <MemoryRouter>
        <TagBadgeList tags={tags} />
      </MemoryRouter>
    );

    expect(screen.getByText('+2')).toBeInTheDocument();
  });
});
