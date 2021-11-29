import { render } from '@testing-library/react';
import React from 'react';
import PageContainer from './PageContainer';

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({ pathName: '/path' }),
}));

jest.mock('../../hooks/authHooks', () => ({
  useAuth: jest.fn().mockReturnValue(true),
}));

describe('Test PageContainer Component', () => {
  it('Component should render', () => {
    const { getByTestId } = render(
      <PageContainer>
        <p>Hello world</p>
      </PageContainer>
    );

    const container = getByTestId('container');

    expect(container).toBeInTheDocument();
  });

  it('left panel containt should display if provided', () => {
    const { queryByText } = render(
      <PageContainer leftPanelContent="left panel">
        <p>Hello world</p>
      </PageContainer>
    );

    const leftPanel = queryByText(/left panel/i);

    expect(leftPanel).toBeInTheDocument();
  });
});
