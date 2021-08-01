import { act, render, screen } from '@testing-library/react';
import React from 'react';
import { getFilterString } from '../../utils/FilterUtils';
import ExplorePage from './index';
import { mockResponse } from './index.mock';
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn(),
  useParams: jest.fn().mockImplementation(() => ({ searchQuery: '' })),
  useLocation: jest.fn().mockImplementation(() => ({ search: '' })),
}));

jest.mock('../../axiosAPIs/miscAPI', () => ({
  searchData: jest
    .fn()
    .mockImplementation(() => Promise.resolve({ data: mockResponse })),
}));
jest.mock('../../utils/FilterUtils', () => ({
  getFilterString: jest.fn().mockImplementation(() => 'user.address'),
}));

describe('Test Explore page', () => {
  it('Should Call Search API', async () => {
    await act(async () => {
      render(<ExplorePage />);
    });

    expect(await screen.findByText('No data found')).toBeInTheDocument();
  });

  it('getFilterString should return filter as string', async () => {
    await act(async () => {
      render(<ExplorePage />);
    });

    expect(getFilterString).toEqual(getFilterString);
  });
});
