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
import { ArrayChange } from 'diff';
import {
  LabelType,
  State,
  TagLabel,
  TagSource,
} from '../../../generated/type/tagLabel';
import { TagsDiffView } from './TagsDiffView';

const mockDiff: ArrayChange<TagLabel>[] = [
  {
    count: 2,
    added: false,
    removed: true,
    value: [
      {
        tagFQN: 'PersonalData.Personal',
        description:
          'Data that can be used to directly or indirectly identify a person.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Suggested,
      },
      {
        tagFQN: 'PII.NonSensitive',
        description:
          'PII which is easily accessible from public sources and can include zip code, race, gender, and date of birth.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Suggested,
      },
    ],
  },
  {
    count: 3,
    removed: false,
    added: true,
    value: [
      {
        labelType: LabelType.Manual,
        state: State.Suggested,
        source: TagSource.Classification,
        tagFQN: 'PersonalData.Personal',
      },
      {
        labelType: LabelType.Manual,
        state: State.Suggested,
        source: TagSource.Classification,
        tagFQN: 'PII.NonSensitive',
      },
      {
        labelType: LabelType.Manual,
        state: State.Suggested,
        source: TagSource.Classification,
        tagFQN: 'PersonalData.SpecialCategory',
      },
    ],
  },
];

const mockEmptyDiff: ArrayChange<TagLabel>[] = [
  {
    count: 0,
    added: false,
    removed: false,
    value: [],
  },
];

describe('Test DiffView Component', () => {
  it('Should render the component', async () => {
    render(<TagsDiffView diffArr={mockDiff} />);

    const container = await screen.findByTestId('diff-container');

    expect(container).toBeInTheDocument();
  });

  it('Should render the no diff placeholder component if diff list is empty', async () => {
    render(<TagsDiffView diffArr={mockEmptyDiff} />);

    const noDiffPlaceholder = await screen.findByTestId('noDiff-placeholder');

    expect(noDiffPlaceholder).toBeInTheDocument();
  });

  it('Should render expected diff values', async () => {
    const newContentList = mockDiff.filter((diff) => diff.added);
    const removedontentList = mockDiff.filter((diff) => diff.removed);

    render(<TagsDiffView diffArr={mockDiff} />);

    const diffAdded = await screen.findAllByTestId('diff-added');
    const diffRemoved = await screen.findAllByTestId('diff-removed');

    expect(diffAdded).toHaveLength(newContentList.length);
    expect(diffRemoved).toHaveLength(removedontentList.length);
  });
});
