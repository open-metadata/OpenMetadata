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
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RelatedDataAssets from './RelatedDataAssets';

jest.mock('./RelatedDataAssetsForm', () => ({
  RelatedDataAssetsForm: () => <div data-testid="dataAssetsForm" />,
}));

const mockRelatedDataAssets = [
  { id: 'team-123', type: 'team', name: 'team1', displayName: 'team1' },
  { id: 'user-123', type: 'user', name: 'user1', displayName: 'user1' },
  { id: 'table-123', type: 'table', name: 'table1', displayName: 'table1' },
  { id: 'topic-123', type: 'topic', name: 'topic1', displayName: 'topic1' },
];
const mockOnRelatedDataAssetsUpdate = jest.fn();

jest.mock('utils/EntityUtils', () => ({
  getEntityName: jest
    .fn()
    .mockImplementation((entity) => entity.displayName || entity.name),
}));
jest.mock('utils/TableUtils', () => ({
  getEntityIcon: jest.fn(),
}));

jest.mock('pages/TasksPage/shared/DescriptionTaskNew');
jest.mock('pages/TasksPage/shared/DescriptionTask');

describe('RelatedDataAssets', () => {
  it('should render', () => {
    render(
      <RelatedDataAssets
        hasPermission
        relatedDataAssets={mockRelatedDataAssets}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('header-label')).toBeInTheDocument();
    expect(screen.getByText('label.data-asset-plural')).toBeInTheDocument();

    expect(screen.getByTestId('edit-data-assets')).toBeInTheDocument();

    expect(screen.getByTestId('data-assets-list-body')).toBeInTheDocument();

    // should render the assets
    expect(screen.getByTestId('table1')).toBeInTheDocument();
    expect(screen.getByTestId('topic1')).toBeInTheDocument();

    // should not render the team type as it is not a data asset
    expect(screen.queryByTestId('team1')).not.toBeInTheDocument();

    // should not render the user type as it is not a data asset
    expect(screen.queryByTestId('user1')).not.toBeInTheDocument();

    // should not render the add data assets button
    expect(
      screen.queryByTestId('add-data-assets-button')
    ).not.toBeInTheDocument();

    // should not render the show more button
    expect(screen.queryByTestId('show-more-button')).not.toBeInTheDocument();

    // should not render the edit form
    expect(screen.queryByTestId('dataAssetsForm')).not.toBeInTheDocument();
  });

  it('should render the add data assets button if no relatedDataAssets', async () => {
    render(
      <RelatedDataAssets
        hasPermission
        relatedDataAssets={[]}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(
      await screen.findByTestId('add-data-assets-container')
    ).toBeInTheDocument();

    // should not render the edit button
    expect(screen.queryByTestId('edit-data-assets')).not.toBeInTheDocument();
  });

  it('should render the show more button if relatedDataAssets.length > 5', () => {
    render(
      <RelatedDataAssets
        hasPermission
        relatedDataAssets={[
          ...mockRelatedDataAssets,
          { id: 'table-456', type: 'table', name: 'table56' },
          { id: 'table-457', type: 'table', name: 'table57' },
          { id: 'table-458', type: 'table', name: 'table58' },
          { id: 'table-459', type: 'table', name: 'table59' },
        ]}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.getByTestId('show-more')).toBeInTheDocument();
  });

  it('should render the edit form when edit button is clicked', async () => {
    render(
      <RelatedDataAssets
        hasPermission
        relatedDataAssets={mockRelatedDataAssets}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.queryByTestId('dataAssetsForm')).not.toBeInTheDocument();

    // click on edit button
    await act(async () => {
      fireEvent.click(screen.getByTestId('edit-data-assets'));
    });

    expect(screen.getByTestId('dataAssetsForm')).toBeInTheDocument();
  });

  it('should render the show less button when show more button is clicked', async () => {
    render(
      <RelatedDataAssets
        hasPermission
        relatedDataAssets={[
          ...mockRelatedDataAssets,
          { id: 'table-456', type: 'table', name: 'table56' },
          { id: 'table-457', type: 'table', name: 'table57' },
          { id: 'table-458', type: 'table', name: 'table58' },
          { id: 'table-459', type: 'table', name: 'table59' },
          { id: 'table-460', type: 'table', name: 'table60' },
        ]}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    // should not render the hidden assets
    expect(screen.queryByTestId('table59')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table60')).not.toBeInTheDocument();

    // click on show more button
    await act(async () => {
      fireEvent.click(screen.getByTestId('show-more'));
    });

    expect(screen.getByTestId('show-less')).toBeInTheDocument();

    // should render the hidden assets
    expect(screen.getByTestId('table59')).toBeInTheDocument();
    expect(screen.getByTestId('table60')).toBeInTheDocument();
  });

  it('should render the show more button when show less button is clicked', async () => {
    render(
      <RelatedDataAssets
        hasPermission
        relatedDataAssets={[
          ...mockRelatedDataAssets,
          { id: 'table-456', type: 'table', name: 'table56' },
          { id: 'table-457', type: 'table', name: 'table57' },
          { id: 'table-458', type: 'table', name: 'table58' },
          { id: 'table-459', type: 'table', name: 'table59' },
          { id: 'table-460', type: 'table', name: 'table60' },
        ]}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    // click on show more button
    await act(async () => {
      fireEvent.click(screen.getByTestId('show-more'));
    });

    // should render the hidden assets
    expect(screen.getByTestId('table59')).toBeInTheDocument();
    expect(screen.getByTestId('table60')).toBeInTheDocument();

    // click on show less button
    await act(async () => {
      fireEvent.click(screen.getByTestId('show-less'));
    });

    expect(screen.getByTestId('show-more')).toBeInTheDocument();

    // should not render the hidden assets
    expect(screen.queryByTestId('table59')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table60')).not.toBeInTheDocument();
  });

  it("should render nothing if user doesn't have permission and no related data assets", () => {
    render(
      <RelatedDataAssets
        hasPermission={false}
        relatedDataAssets={[]}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.queryByTestId('header-label')).not.toBeInTheDocument();
    expect(
      screen.queryByText('label.data-asset-plural')
    ).not.toBeInTheDocument();

    expect(screen.queryByTestId('edit-data-assets')).not.toBeInTheDocument();

    expect(
      screen.queryByTestId('data-assets-list-body')
    ).not.toBeInTheDocument();

    // should not render the add data assets button
    expect(
      screen.queryByTestId('add-data-assets-button')
    ).not.toBeInTheDocument();

    // should not render the show more button
    expect(screen.queryByTestId('show-more-button')).not.toBeInTheDocument();

    // should not render the edit form
    expect(screen.queryByTestId('dataAssetsForm')).not.toBeInTheDocument();
  });

  it("should not render the add data assets button if no relatedDataAssets and user doesn't have permission", () => {
    render(
      <RelatedDataAssets
        hasPermission={false}
        relatedDataAssets={[]}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(
      screen.queryByTestId('add-data-assets-button')
    ).not.toBeInTheDocument();
  });

  it("should not render the edit data assets button if user doesn't have permission", () => {
    render(
      <RelatedDataAssets
        hasPermission={false}
        relatedDataAssets={mockRelatedDataAssets}
        onRelatedDataAssetsUpdate={mockOnRelatedDataAssetsUpdate}
      />,
      { wrapper: MemoryRouter }
    );

    expect(screen.queryByTestId('edit-data-assets')).not.toBeInTheDocument();
  });
});
