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
import { EntityType } from '../../../enums/entity.enum';
import { ChangeSource } from '../../../generated/type/changeSummaryMap';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import Description from './Description';

const mockOnThreadLinkSelect = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test.fqn' }),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(),
}));

jest.mock('../../Suggestions/SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: jest.fn(),
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown }) => (
      <div data-testid="previewer">{markdown}</div>
    ))
);

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockImplementation(() => <div data-testid="edit-modal" />),
  })
);

jest.mock('./EntityAttachmentProvider/EntityAttachmentProvider', () => ({
  EntityAttachmentProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock('../DescriptionSourceBadge/DescriptionSourceBadge', () =>
  jest
    .fn()
    .mockImplementation(({ showBadge }) =>
      showBadge === false ? <div data-testid="authored-by-footer" /> : null
    )
);

jest.mock('../../Suggestions/SuggestionsSlider/SuggestionsSlider', () =>
  jest.fn().mockImplementation(() => <div data-testid="suggestions-slider" />)
);

jest.mock('../../Suggestions/SuggestionsAlert/SuggestionsAlert', () =>
  jest.fn().mockImplementation(() => <div data-testid="suggestions-alert" />)
);

const mockUseGenericContext = useGenericContext as jest.Mock;
const mockUseSuggestionsContext = useSuggestionsContext as jest.Mock;

const defaultProps = {
  description: 'Sample description',
  entityType: EntityType.TABLE,
  entityName: 'test_table',
  hasEditAccess: true,
  onDescriptionUpdate: jest.fn(),
};

describe('Description', () => {
  beforeEach(() => {
    mockUseGenericContext.mockReturnValue({
      isVersionView: false,
      changeSummary: {},
      onThreadLinkSelect: mockOnThreadLinkSelect,
    });
    mockUseSuggestionsContext.mockReturnValue({
      suggestions: [],
      selectedUserSuggestions: { description: [] },
    });
  });

  it('should render the description title, container and previewer', () => {
    render(<Description {...defaultProps} wrapInCard />);

    expect(
      screen.getByTestId('asset-description-container')
    ).toBeInTheDocument();
    expect(screen.getByText('label.description')).toBeInTheDocument();
    expect(screen.getByTestId('previewer')).toHaveTextContent(
      'Sample description'
    );
  });

  it('should show the edit button when edit access is granted', () => {
    render(<Description {...defaultProps} wrapInCard />);

    expect(screen.getByTestId('edit-description')).toBeInTheDocument();
  });

  it('should hide the edit button in version view', () => {
    mockUseGenericContext.mockReturnValue({
      isVersionView: true,
      changeSummary: {},
      onThreadLinkSelect: mockOnThreadLinkSelect,
    });

    render(<Description {...defaultProps} wrapInCard />);

    expect(screen.queryByTestId('edit-description')).not.toBeInTheDocument();
  });

  it('should render the comment thread button by default', () => {
    render(<Description {...defaultProps} wrapInCard />);

    expect(screen.getByTestId('description-thread')).toBeInTheDocument();
  });

  it('should render the authored-by footer when change metadata is present', () => {
    mockUseGenericContext.mockReturnValue({
      isVersionView: false,
      changeSummary: {
        description: {
          changeSource: ChangeSource.Manual,
          changedBy: 'teddy',
          changedAt: 1700000000000,
        },
      },
      onThreadLinkSelect: mockOnThreadLinkSelect,
    });

    render(<Description {...defaultProps} wrapInCard />);

    expect(screen.getByTestId('authored-by-footer')).toBeInTheDocument();
  });
});
