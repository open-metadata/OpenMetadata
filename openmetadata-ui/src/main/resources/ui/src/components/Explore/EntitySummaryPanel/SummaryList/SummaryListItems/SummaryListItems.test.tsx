/*
 *  Copyright 2023 Collate.
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
import {
  mockEntityDetails,
  mockEntityDetailsWithConstraint,
  mockEntityDetailsWithoutDescription,
  mockEntityDetailsWithTagsAndAlgorithm,
} from '../../mocks/SummaryListItems.mock';
import SummaryListItem from './SummaryListItems.component';

jest.mock('../../../../common/RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(() => (
      <div data-testid="RichTextEditorPreviewer">RichTextEditorPreviewer</div>
    ))
);

jest.mock('../../../../Tag/TagsViewer/TagsViewer', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="TagsViewer">TagsViewer</div>)
);

jest.mock('../../../../common/Badge/Badge.component', () =>
  jest
    .fn()
    .mockImplementation(() => <div data-testid="entity-type">AppBadge</div>)
);

jest.mock('../../../../../utils/TableUtils', () => ({
  prepareConstraintIcon: jest
    .fn()
    .mockImplementation(() => <div data-testid="constraints">Constraints</div>),
}));

describe('SummaryListItems component tests', () => {
  it('Component should render properly with title, type and description of the entity', () => {
    const { getByTestId } = render(
      <SummaryListItem entityDetails={mockEntityDetails} />
    );

    const titleContainer = getByTestId('title-container');
    const title = getByTestId('title');
    const type = getByTestId('entity-type');
    const description = getByTestId('RichTextEditorPreviewer');

    expect(titleContainer).toBeInTheDocument();
    expect(title).toContainHTML('Title');
    expect(type).toBeInTheDocument();
    expect(description).toBeInTheDocument();
  });

  it('tags and algorithm should not render if entity has no tags and algorithm', () => {
    const { queryByTestId } = render(
      <SummaryListItem entityDetails={mockEntityDetails} />
    );

    const tags = queryByTestId('TagsViewer');
    const algorithm = queryByTestId('algorithm');

    expect(tags).toBeNull();
    expect(algorithm).toBeNull();
  });

  it('tags and algorithm should render if entity has tags and algorithm', () => {
    const { getByTestId } = render(
      <SummaryListItem entityDetails={mockEntityDetailsWithTagsAndAlgorithm} />
    );

    const tags = getByTestId('TagsViewer');
    const algorithm = getByTestId('algorithm');

    expect(tags).toBeInTheDocument();
    expect(algorithm).toBeInTheDocument();
    expect(algorithm).toContainHTML(
      mockEntityDetailsWithTagsAndAlgorithm.algorithm
    );
  });

  it('no description placeholder should be displayed for entity having no description', async () => {
    const { getByText, queryByTestId } = render(
      <SummaryListItem entityDetails={mockEntityDetailsWithoutDescription} />
    );

    const richTextEditorPreviewer = queryByTestId('RichTextEditorPreviewer');
    const noDescription = getByText('label.no-entity');

    expect(richTextEditorPreviewer).toBeNull();
    expect(noDescription).toBeInTheDocument();
  });

  it('constraint icon should not be present for entity without constraint details', async () => {
    const { queryByTestId } = render(
      <SummaryListItem entityDetails={mockEntityDetails} />
    );

    const richTextEditorPreviewer = queryByTestId('constraints');

    expect(richTextEditorPreviewer).toBeNull();
  });

  it('constraint icon should not be present for entity if isColumnsData prop is not true', async () => {
    const { queryByTestId } = render(
      <SummaryListItem entityDetails={mockEntityDetailsWithConstraint} />
    );

    const richTextEditorPreviewer = queryByTestId('constraints');

    expect(richTextEditorPreviewer).toBeNull();
  });

  it('constraint icon should be displayed for entity with constraint details', async () => {
    const { getByTestId } = render(
      <SummaryListItem
        isColumnsData
        entityDetails={mockEntityDetailsWithConstraint}
      />
    );

    const richTextEditorPreviewer = getByTestId('constraints');

    expect(richTextEditorPreviewer).toBeInTheDocument();
  });
});
