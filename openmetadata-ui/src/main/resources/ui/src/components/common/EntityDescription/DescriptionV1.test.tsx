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

import { act, render, screen } from '@testing-library/react';
import { ComponentType, ReactNode, Suspense } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { ChangeSummaryEntry } from '../../../rest/changeSummaryAPI';
import DescriptionV1 from './DescriptionV1';

const mockUseGenericContext = jest.fn();

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: () => mockUseGenericContext(),
}));

jest.mock('../../Suggestions/SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: () => ({
    suggestions: [],
    selectedUserSuggestions: undefined,
  }),
}));

jest.mock('../DescriptionSourceBadge/DescriptionSourceBadge', () => ({
  __esModule: true,
  default: ({
    changeSummaryEntry,
    showBadge,
  }: {
    changeSummaryEntry?: ChangeSummaryEntry;
    showBadge?: boolean;
  }) =>
    changeSummaryEntry?.changeSource ? (
      <div
        data-changed-by={changeSummaryEntry.changedBy}
        data-show-badge={String(showBadge ?? true)}
        data-testid="description-source-badge">
        source-badge
      </div>
    ) : null,
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => (
    <div data-testid="rich-text-previewer">{markdown}</div>
  ),
}));

jest.mock('../ExpandableCard/ExpandableCard', () => ({
  __esModule: true,
  default: ({
    cardProps,
    children,
  }: {
    cardProps?: { title?: ReactNode };
    children?: ReactNode;
  }) => (
    <div data-testid="expandable-card">
      {cardProps?.title}
      {children}
    </div>
  ),
}));

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: () => null,
  })
);

jest.mock('../../Suggestions/SuggestionsAlert/SuggestionsAlert', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../Suggestions/SuggestionsSlider/SuggestionsSlider', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../AppRouter/withSuspenseFallback', () => ({
  __esModule: true,
  default: (Component: ComponentType<Record<string, unknown>>) =>
    function WithSuspenseFallback(props: Record<string, unknown>) {
      return (
        <Suspense fallback={null}>
          <Component {...props} />
        </Suspense>
      );
    },
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: () => ({ fqn: 'entity.fqn' }),
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

const manualEntry: ChangeSummaryEntry = {
  changeSource: 'Manual',
  changedBy: 'prop-author',
  changedAt: 1783100000000,
} as ChangeSummaryEntry;

const contextEntry: ChangeSummaryEntry = {
  changeSource: 'Manual',
  changedBy: 'context-author',
  changedAt: 1783000000000,
} as ChangeSummaryEntry;

const footerBadge = () =>
  screen
    .queryAllByTestId('description-source-badge')
    .find((el) => el.getAttribute('data-show-badge') === 'false');

describe('DescriptionV1 description attribution', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGenericContext.mockReturnValue({
      isVersionView: false,
      changeSummary: undefined,
      onThreadLinkSelect: jest.fn(),
    });
  });

  it('should render the attribution footer from the explicit changeSummaryEntry prop without a provider entry', async () => {
    await act(async () => {
      render(
        <DescriptionV1
          changeSummaryEntry={manualEntry}
          description="some description"
          entityType={EntityType.TEST_SUITE}
        />
      );
    });

    expect(footerBadge()).toHaveAttribute('data-changed-by', 'prop-author');
  });

  it('should prefer the explicit prop over the provider change summary', async () => {
    mockUseGenericContext.mockReturnValue({
      isVersionView: false,
      changeSummary: { description: contextEntry },
      onThreadLinkSelect: jest.fn(),
    });

    await act(async () => {
      render(
        <DescriptionV1
          changeSummaryEntry={manualEntry}
          description="some description"
          entityType={EntityType.TEST_SUITE}
        />
      );
    });

    expect(footerBadge()).toHaveAttribute('data-changed-by', 'prop-author');
  });

  it('should fall back to the provider change summary when no prop is given', async () => {
    mockUseGenericContext.mockReturnValue({
      isVersionView: false,
      changeSummary: { description: contextEntry },
      onThreadLinkSelect: jest.fn(),
    });

    await act(async () => {
      render(
        <DescriptionV1
          description="some description"
          entityType={EntityType.TEST_SUITE}
        />
      );
    });

    expect(footerBadge()).toHaveAttribute('data-changed-by', 'context-author');
  });

  it('should render no attribution footer when neither prop nor provider have an entry', async () => {
    await act(async () => {
      render(
        <DescriptionV1
          description="some description"
          entityType={EntityType.TEST_SUITE}
        />
      );
    });

    expect(footerBadge()).toBeUndefined();
  });
});
