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
import { render, screen } from '@testing-library/react';
import React from 'react';
import FollowingWidget from './FollowingWidget';

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
  useNavigate: jest.fn().mockReturnValue(jest.fn()),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: {
      id: '1',
      name: 'testUser',
      teams: [],
    },
  }),
}));

const mockProps = {
  followedData: [
    {
      id: '1',
      type: 'table',
      name: 'Data 1',
      description: 'Description 1',
      displayName: 'Data 1',
      fullyQualifiedName: 'org.data.1',
      href: '/entity/1',
      deleted: false,
      inherited: false,
    },
  ],
  isLoadingOwnedData: false,
  widgetKey: 'testKey',
  handleLayoutUpdate: jest.fn(),
  currentLayout: [],
};

describe('FollowingWidget', () => {
  it('should render Following Widget', () => {
    render(<FollowingWidget {...mockProps} />);

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
    expect(screen.getByText('label.following-assets')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    render(<FollowingWidget {...mockProps} isLoadingOwnedData />);

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<FollowingWidget {...mockProps} followedData={[]} />);

    expect(screen.getByTestId('widget-wrapper')).toBeInTheDocument();
    expect(
      screen.getByText('message.not-following-any-assets-yet')
    ).toBeInTheDocument();
    expect(
      screen.getByText('message.not-followed-anything')
    ).toBeInTheDocument();
  });

  it('should show edit controls when in edit view', () => {
    render(<FollowingWidget {...mockProps} isEditView />);

    expect(screen.getByTestId('drag-widget-button')).toBeInTheDocument();
    expect(screen.getByTestId('more-options-button')).toBeInTheDocument();
  });

  it('should render followed data items', () => {
    render(<FollowingWidget {...mockProps} />);

    expect(screen.getByText('Data 1')).toBeInTheDocument();
    expect(screen.getByTestId('Following-Data 1')).toBeInTheDocument();
  });

  it('should show view more link', () => {
    render(<FollowingWidget {...mockProps} />);

    expect(screen.getByText('label.view-more-count')).toBeInTheDocument();
  });
});
