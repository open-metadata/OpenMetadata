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
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import TagsViewer from './TagsViewer';

// Distinguishable chip mocks: each chip renders a unique data-testid so tests can assert which
// constructor TagsViewer reached — the AutoClassificationTag (brand-blue, Generated) path or the
// ClassificationTag (plain) path. The sibling TagsViewer.test.tsx mocks all three chips to
// identical `<p>TagsV1</p>` markup, which makes the Generated/Manual constructor switch invisible.
jest.mock('@openmetadata/ui-core-components', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components'),
  AutoClassificationTag: jest
    .fn()
    .mockImplementation((props: { label?: string }) => (
      <span data-testid="auto-tag">{props.label}</span>
    )),
  ClassificationTag: jest
    .fn()
    .mockImplementation((props: { label?: string }) => (
      <span data-testid="cls-tag">{props.label}</span>
    )),
  GlossaryTag: jest
    .fn()
    .mockImplementation((props: { label?: string }) => (
      <span data-testid="glossary-tag">{props.label}</span>
    )),
}));

const generatedTag = {
  tagFQN: 'PII.Sensitive',
  source: TagSource.Classification,
  labelType: LabelType.Generated,
  state: State.Confirmed,
};

const manualTag = {
  tagFQN: 'PII.Sensitive',
  source: TagSource.Classification,
  labelType: LabelType.Manual,
  state: State.Confirmed,
};

describe('TagsViewer Generated-tag rendering', () => {
  it('renders AutoClassificationTag for a Generated tag with an entity-level FQN', () => {
    render(
      <TagsViewer
        entityFqn="sample.db.schema.table"
        sizeCap={-1}
        tags={[generatedTag]}
      />
    );

    expect(screen.getByTestId('auto-tag')).toBeInTheDocument();
    expect(screen.queryByTestId('cls-tag')).toBeNull();
  });

  it('renders AutoClassificationTag for a Generated tag with a column-level FQN', () => {
    render(
      <TagsViewer
        entityFqn="sample.db.schema.table.columns.col1"
        sizeCap={-1}
        tags={[generatedTag]}
      />
    );

    expect(screen.getByTestId('auto-tag')).toBeInTheDocument();
    expect(screen.queryByTestId('cls-tag')).toBeNull();
  });

  it('renders ClassificationTag for a Generated tag when entityFqn is absent (guard behavior)', () => {
    render(<TagsViewer sizeCap={-1} tags={[generatedTag]} />);

    expect(screen.getByTestId('cls-tag')).toBeInTheDocument();
    expect(screen.queryByTestId('auto-tag')).toBeNull();
  });

  it('renders ClassificationTag for a Manual tag regardless of entityFqn', () => {
    render(
      <TagsViewer
        entityFqn="sample.db.schema.table"
        sizeCap={-1}
        tags={[manualTag]}
      />
    );

    expect(screen.getByTestId('cls-tag')).toBeInTheDocument();
    expect(screen.queryByTestId('auto-tag')).toBeNull();
  });
});
