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
import {
  render,
  screen,
  waitForElementToBeRemoved,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { User } from '../../../generated/entity/teams/user';
import { useApplicationStore } from '../../../hooks/useApplicationStore';
import { getUserById } from '../../../rest/userAPI';
import BookMarkWidget from './BookMarkWidget';

const mockUserData: User = {
  name: 'aaron_johnson0',
  email: 'testUser1@email.com',
  id: '9304f330-2e9a-4513-883b-c939e29683a8',
};

jest.mock('hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockImplementation(() => ({
    currentUser: mockUserData,
  })),
}));

jest.mock('components/common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <div>Mocked Loader</div>)
);

jest.mock('rest/userAPI', () => {
  return {
    getUserById: jest.fn().mockImplementation(() => {
      return Promise.resolve({
        follows: [
          {
            type: 'page',
            id: 'test-page-id',
            displayName: 'test-page-name',
            fullyQualifiedName: 'test-page-fqn',
          },
        ],
      });
    }),
  };
});

jest.mock('utils/ToastUtils', () => {
  return {
    showErrorToast: jest.fn().mockImplementation(() => {
      return 'Mocked showErrorToast';
    }),
  };
});

jest.mock('../../../utils/KnowledgePageUtils', () => ({
  ...jest.requireActual('../../../utils/KnowledgePageUtils'),
  getKnowledgePagePath: jest.fn().mockImplementation(() => {
    return '/knowledge-center/test-page-fqn';
  }),
}));

const mockHandleRefreshBookMarkWidget = jest.fn();

const mockProps = {
  refresh: false,
  handleRefreshBookMarkWidget: mockHandleRefreshBookMarkWidget,
};

describe('BookMarkWidget', () => {
  it('should render BookMarkWidget', async () => {
    render(<BookMarkWidget {...mockProps} />, { wrapper: MemoryRouter });

    await waitForElementToBeRemoved(() => screen.getByText('Mocked Loader'));

    const bookmarkedPage = screen.getByTestId('bookmarked-test-page-name');

    expect(bookmarkedPage).toHaveTextContent('test-page-name');
    expect(bookmarkedPage).toHaveAttribute(
      'href',
      '/context-center/articles/test-page-fqn'
    );

    expect(screen.getByText('label.bookmark-plural')).toBeInTheDocument();

    expect(screen.queryByText('Mocked showErrorToast')).not.toBeInTheDocument();

    expect(mockHandleRefreshBookMarkWidget).toHaveBeenCalledWith(false);
  });

  it('should not call the getUserById if currentUser is not present', async () => {
    (useApplicationStore as unknown as jest.Mock).mockImplementationOnce(
      () => ({
        currentUser: null,
      })
    );

    render(<BookMarkWidget {...mockProps} />, { wrapper: MemoryRouter });

    expect(screen.queryByText('test-page-name')).not.toBeInTheDocument();
    expect(screen.queryByText('test-page-fqn')).not.toBeInTheDocument();
    expect(screen.queryByText('Mocked showErrorToast')).not.toBeInTheDocument();

    expect(getUserById).not.toHaveBeenCalled();
  });

  it('should render the placeholder text if there are no bookmarks', async () => {
    (getUserById as jest.Mock).mockImplementation(() => {
      return Promise.resolve({
        follows: [],
      });
    });

    render(<BookMarkWidget {...mockProps} />, { wrapper: MemoryRouter });

    await waitForElementToBeRemoved(() => screen.getByText('Mocked Loader'));

    expect(screen.queryByText('test-page-name')).not.toBeInTheDocument();
    expect(screen.queryByText('test-page-fqn')).not.toBeInTheDocument();
    expect(screen.queryByText('Mocked showErrorToast')).not.toBeInTheDocument();

    expect(
      screen.getByText('message.not-bookmark-anything')
    ).toBeInTheDocument();
  });

  it("should render the title as 'Untitled' if the displayName is not present", async () => {
    (getUserById as jest.Mock).mockImplementation(() => {
      return Promise.resolve({
        follows: [
          {
            type: 'page',
            id: 'test-page-id',
            displayName: null,
            fullyQualifiedName: 'test-page-fqn',
          },
        ],
      });
    });

    render(<BookMarkWidget {...mockProps} />, { wrapper: MemoryRouter });

    await waitForElementToBeRemoved(() => screen.getByText('Mocked Loader'));

    // test id should have the fullyQualifiedName
    const bookmarkedPage = screen.getByTestId('bookmarked-test-page-fqn');

    expect(bookmarkedPage).toHaveTextContent('label.untitled');
    expect(bookmarkedPage).toHaveAttribute(
      'href',
      '/context-center/articles/test-page-fqn'
    );
  });
});
