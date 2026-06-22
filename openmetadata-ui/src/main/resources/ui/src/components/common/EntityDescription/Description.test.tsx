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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { ChangeSource } from '../../../generated/type/changeSummaryMap';
import { getEntityFeedLink } from '../../../utils/EntityPureUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import { useSuggestionsContext } from '../../Suggestions/SuggestionsProvider/SuggestionsProvider';
import Description from './Description';

const mockOnThreadLinkSelect = jest.fn();
const mockNavigate = jest.fn();
const mockOnDescriptionUpdate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn().mockImplementation((props) => (
    <button data-testid={props['data-testid']} onClick={props.onPress}>
      {props.children}
    </button>
  )),
  Divider: jest.fn().mockImplementation(() => <hr />),
  Tooltip: jest.fn().mockImplementation((props) => props.children),
  Typography: jest
    .fn()
    .mockImplementation((props) => <span>{props.children}</span>),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test.fqn' }),
}));

jest.mock('../../../utils/TasksUtils', () => ({
  ...jest.requireActual('../../../utils/TasksUtils'),
  getRequestDescriptionPath: jest.fn().mockReturnValue('/request-path'),
  getUpdateDescriptionPath: jest.fn().mockReturnValue('/update-path'),
}));

jest.mock('../../Customization/GenericProvider/GenericContext', () => ({
  useGenericContext: jest.fn(),
}));

jest.mock('../../Suggestions/SuggestionsProvider/SuggestionsProvider', () => ({
  useSuggestionsContext: jest.fn(),
}));

jest.mock('../RichTextEditor/RichTextEditorPreviewerV1', () =>
  jest
    .fn()
    .mockImplementation(({ markdown, className, enableSeeMoreVariant }) => (
      <div
        data-classname={className}
        data-see-more={String(enableSeeMoreVariant)}
        data-testid="previewer">
        {markdown}
      </div>
    ))
);

jest.mock(
  '../../Modals/ModalWithMarkdownEditor/ModalWithMarkdownEditor',
  () => ({
    ModalWithMarkdownEditor: jest
      .fn()
      .mockImplementation(({ visible, onSave, onCancel }) =>
        visible ? (
          <div data-testid="edit-modal">
            <button
              data-testid="modal-save"
              onClick={() => onSave('Updated description')}
            />
            <button data-testid="modal-cancel" onClick={onCancel} />
          </div>
        ) : null
      ),
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
  onDescriptionUpdate: mockOnDescriptionUpdate,
};

describe('Description', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it('should render the container and previewer without the card wrapper', () => {
    render(<Description {...defaultProps} />);

    expect(
      screen.getByTestId('asset-description-container')
    ).toBeInTheDocument();
    expect(screen.getByTestId('previewer')).toHaveTextContent(
      'Sample description'
    );
  });

  it('should show the edit button when edit access is granted', () => {
    render(<Description {...defaultProps} />);

    expect(screen.getByTestId('edit-description')).toBeInTheDocument();
  });

  it('should hide the edit button when edit access is not granted', () => {
    render(<Description {...defaultProps} hasEditAccess={false} />);

    expect(screen.queryByTestId('edit-description')).not.toBeInTheDocument();
  });

  it('should hide the edit button when read only', () => {
    render(<Description {...defaultProps} isReadOnly />);

    expect(screen.queryByTestId('edit-description')).not.toBeInTheDocument();
  });

  it('should hide the edit button in version view', () => {
    mockUseGenericContext.mockReturnValue({
      isVersionView: true,
      changeSummary: {},
      onThreadLinkSelect: mockOnThreadLinkSelect,
    });

    render(<Description {...defaultProps} />);

    expect(screen.queryByTestId('edit-description')).not.toBeInTheDocument();
  });

  it('should hide all action buttons when showActions is false', () => {
    render(<Description {...defaultProps} showActions={false} />);

    expect(screen.queryByTestId('edit-description')).not.toBeInTheDocument();
    expect(screen.queryByTestId('description-thread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-description')).not.toBeInTheDocument();
  });

  it('should render the comment thread button by default', () => {
    render(<Description {...defaultProps} />);

    expect(screen.getByTestId('description-thread')).toBeInTheDocument();
  });

  it('should hide the comment thread button when showCommentsIcon is false', () => {
    render(<Description {...defaultProps} showCommentsIcon={false} />);

    expect(screen.queryByTestId('description-thread')).not.toBeInTheDocument();
    expect(screen.getByTestId('edit-description')).toBeInTheDocument();
  });

  it('should call onThreadLinkSelect with the description link on thread click', () => {
    render(<Description {...defaultProps} />);

    fireEvent.click(screen.getByTestId('description-thread'));

    expect(mockOnThreadLinkSelect).toHaveBeenCalledWith(
      expect.stringContaining('description')
    );
  });

  it('should open the editor modal when the edit button is clicked', () => {
    render(<Description {...defaultProps} />);

    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('edit-description'));

    expect(screen.getByTestId('edit-modal')).toBeInTheDocument();
  });

  it('should call onDescriptionUpdate and close the modal on save', async () => {
    render(<Description {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-description'));
    fireEvent.click(screen.getByTestId('modal-save'));

    await waitFor(() =>
      expect(mockOnDescriptionUpdate).toHaveBeenCalledWith(
        'Updated description'
      )
    );
    await waitFor(() =>
      expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument()
    );
  });

  it('should close the modal on cancel without calling onDescriptionUpdate', () => {
    render(<Description {...defaultProps} />);

    fireEvent.click(screen.getByTestId('edit-description'));
    fireEvent.click(screen.getByTestId('modal-cancel'));

    expect(screen.queryByTestId('edit-modal')).not.toBeInTheDocument();
    expect(mockOnDescriptionUpdate).not.toHaveBeenCalled();
  });

  it('should navigate to the update-description path when a description exists', () => {
    render(<Description {...defaultProps} />);

    fireEvent.click(screen.getByTestId('request-description'));

    expect(mockNavigate).toHaveBeenCalledWith('/update-path');
  });

  it('should navigate to the request-description path when description is empty', () => {
    render(<Description {...defaultProps} description="" />);

    fireEvent.click(screen.getByTestId('request-description'));

    expect(mockNavigate).toHaveBeenCalledWith('/request-path');
  });

  it('should not render the request-description button for non task entities', () => {
    render(<Description {...defaultProps} entityType={EntityType.DOMAIN} />);

    expect(screen.queryByTestId('request-description')).not.toBeInTheDocument();
  });

  it('should render the suggestion alert instead of the previewer when a suggestion is active', () => {
    const entityLinkWithoutField = getEntityFeedLink(
      EntityType.TABLE,
      'test.fqn'
    );
    mockUseSuggestionsContext.mockReturnValue({
      suggestions: [],
      selectedUserSuggestions: {
        description: [{ entityLink: entityLinkWithoutField }],
      },
    });

    render(<Description {...defaultProps} />);

    expect(screen.getByTestId('suggestions-alert')).toBeInTheDocument();
    expect(screen.queryByTestId('previewer')).not.toBeInTheDocument();
  });

  it('should render the suggestions slider when suggestions exist and showSuggestions is true', () => {
    mockUseSuggestionsContext.mockReturnValue({
      suggestions: [{ id: '1' }],
      selectedUserSuggestions: { description: [] },
    });

    render(<Description {...defaultProps} showSuggestions />);

    expect(screen.getByTestId('suggestions-slider')).toBeInTheDocument();
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

    render(<Description {...defaultProps} />);

    expect(screen.getByTestId('authored-by-footer')).toBeInTheDocument();
  });

  it('should not render the authored-by footer when change metadata is absent', () => {
    render(<Description {...defaultProps} />);

    expect(screen.queryByTestId('authored-by-footer')).not.toBeInTheDocument();
  });

  it('should pass the truncation class to the previewer when reduceDescription is set', () => {
    render(<Description {...defaultProps} reduceDescription />);

    expect(screen.getByTestId('previewer')).toHaveAttribute(
      'data-classname',
      'max-two-lines'
    );
  });

  it('should disable the see-more variant on the previewer when removeBlur is set', () => {
    render(<Description {...defaultProps} removeBlur />);

    expect(screen.getByTestId('previewer')).toHaveAttribute(
      'data-see-more',
      'false'
    );
  });
});
