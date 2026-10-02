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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TaskComment } from '../../../rest/tasksAPI';
import TaskCommentCard from './TaskCommentCard.component';

const mockPreview = jest.fn();

jest.mock('../../../hooks/user-profile/useUserProfile', () => ({
  useUserProfile: jest.fn().mockReturnValue([null, false, undefined]),
}));

jest.mock('../../common/ProfilePicture/ProfilePicture', () =>
  jest.fn().mockReturnValue(<span>ProfilePicture</span>)
);

jest.mock('../../common/RichTextEditor/RichTextEditorPreviewNew', () =>
  jest.fn().mockImplementation((props) => {
    mockPreview(props);

    return <p data-testid="comment-body">{props.markdown}</p>;
  })
);

jest.mock('../ActivityFeedEditor/ActivityFeedEditorNew', () =>
  jest.fn().mockImplementation(({ onSave, onTextChange }) => (
    <div data-testid="comment-editor">
      <button onClick={() => onTextChange('edited message')}>type</button>
      <button onClick={onSave}>save</button>
    </div>
  ))
);

const comment = {
  id: 'comment-1',
  message: 'original message',
  author: { id: 'user-1', name: 'alice', type: 'user' },
  createdAt: 1726000000000,
} as TaskComment;

const onEdit = jest.fn().mockResolvedValue(undefined);
const onDelete = jest.fn().mockResolvedValue(undefined);
const closeFeedEditor = jest.fn();

const renderCard = (props: { canEdit: boolean; canDelete: boolean }) =>
  render(
    <TaskCommentCard
      closeFeedEditor={closeFeedEditor}
      comment={comment}
      onDelete={onDelete}
      onEdit={onEdit}
      {...props}
    />,
    { wrapper: MemoryRouter }
  );

describe('TaskCommentCard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows no actions to a user who may neither edit nor delete', () => {
    renderCard({ canEdit: false, canDelete: false });

    expect(screen.queryByTestId('feed-actions')).not.toBeInTheDocument();
  });

  it('shows only delete to an admin who is not the author', () => {
    renderCard({ canEdit: false, canDelete: true });

    expect(screen.getByTestId('delete-message')).toBeInTheDocument();
    expect(screen.queryByTestId('edit-message')).not.toBeInTheDocument();
  });

  it('leaves long comments expandable instead of suppressing the toggle', () => {
    renderCard({ canEdit: false, canDelete: false });

    expect(mockPreview).toHaveBeenCalledWith(
      expect.not.objectContaining({ enableSeeMoreVariant: false })
    );
  });

  it('links the author name to their profile', () => {
    renderCard({ canEdit: false, canDelete: false });

    expect(screen.getByTestId('author-name')).toHaveAttribute(
      'href',
      '/users/alice'
    );
  });

  it('deletes only after confirmation and then closes the dialog', async () => {
    renderCard({ canEdit: true, canDelete: true });

    fireEvent.click(screen.getByTestId('delete-message'));

    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(await screen.findByTestId('save-button'));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.queryByTestId('save-button')).not.toBeInTheDocument()
    );
  });

  it('keeps the confirmation open when the delete fails', async () => {
    onDelete.mockRejectedValueOnce(new Error('boom'));
    renderCard({ canEdit: true, canDelete: true });

    fireEvent.click(screen.getByTestId('delete-message'));
    fireEvent.click(await screen.findByTestId('save-button'));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId('save-button')).toBeInTheDocument();
  });

  it('saves the edited message and returns to the preview', async () => {
    renderCard({ canEdit: true, canDelete: true });

    fireEvent.click(screen.getByTestId('edit-message'));

    expect(closeFeedEditor).toHaveBeenCalled();

    await screen.findByTestId('comment-editor');
    fireEvent.click(screen.getByText('type'));
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(onEdit).toHaveBeenCalledWith('edited message'));

    expect(await screen.findByTestId('comment-body')).toBeInTheDocument();
  });

  it('keeps the editor open when the edit fails', async () => {
    onEdit.mockRejectedValueOnce(new Error('boom'));
    renderCard({ canEdit: true, canDelete: true });

    fireEvent.click(screen.getByTestId('edit-message'));
    await screen.findByTestId('comment-editor');
    fireEvent.click(screen.getByText('save'));

    await waitFor(() => expect(onEdit).toHaveBeenCalledTimes(1));

    expect(screen.getByTestId('comment-editor')).toBeInTheDocument();
  });
});
