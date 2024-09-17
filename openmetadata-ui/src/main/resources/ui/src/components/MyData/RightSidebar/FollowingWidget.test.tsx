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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import FollowingWidget from './FollowingWidget';

jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children }: { children: React.ReactNode }) => (
      <p data-testid="link">{children}</p>
    )),
}));

const mockProps = {
  followedData: [
    {
      id: '1',
      type: 'data',
      name: 'Data 1',
      description: 'Description 1',
      displayName: 'Data 1',
      fullyQualifiedName: 'org.data.1',
      href: '/entity/1',
      deleted: false,
      inherited: false,
    },
  ],
  followedDataCount: 1,
  isLoadingOwnedData: false,
  widgetKey: 'testKey',
};

describe('FollowingWidget', () => {
  it('should render Following Widget', () => {
    render(<FollowingWidget {...mockProps} />);

    expect(screen.getByTestId('following-widget')).toBeInTheDocument();
    expect(
      screen.getByTestId('following-data-total-count')
    ).toBeInTheDocument();
    expect(screen.getByText('label.following')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    render(<FollowingWidget {...mockProps} isLoadingOwnedData />);

    expect(screen.getByTestId('entity-list-skeleton')).toBeInTheDocument();
  });

  it('should render empty state', () => {
    render(<FollowingWidget {...mockProps} followedData={[]} />);

    expect(screen.getByTestId('no-data-placeholder')).toBeInTheDocument();
    expect(
      screen.getByText('message.not-followed-anything')
    ).toBeInTheDocument();
  });

  it('should remove widget when close button is clicked', async () => {
    const handleRemoveWidget = jest.fn();

    render(
      <FollowingWidget
        {...mockProps}
        isEditView
        handleRemoveWidget={handleRemoveWidget}
      />
    );
    await act(async () => {
      fireEvent.click(screen.getByTestId('remove-widget-button'));
    });

    expect(handleRemoveWidget).toHaveBeenCalledWith('testKey');
  });
});
