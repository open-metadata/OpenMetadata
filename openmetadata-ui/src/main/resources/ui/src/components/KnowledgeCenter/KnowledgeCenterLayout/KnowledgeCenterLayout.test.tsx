import { render, screen } from '@testing-library/react';
import KnowledgeCenterLayout from './KnowledgeCenterLayout';

jest.mock(
  'components/common/DocumentTitle/DocumentTitle',
  () =>
    jest.fn().mockImplementation(({ title }) => {
      document.title = title;

      return null;
    })
);

jest.mock('react-router-dom', () => ({
  useLocation: jest.fn().mockReturnValue({
    pathname: '/',
  }),
}));

describe('KnowledgeCenterLayout', () => {
  const mockProps = {
    children: <div>Test Children</div>,
    leftSidebar: <div>Test Left Sidebar</div>,
    rightSidebar: <div>Test Right Sidebar</div>,
    pageTitle: 'Test Page Title',
  };

  it('should render correctly', () => {
    render(<KnowledgeCenterLayout {...mockProps} />);

    expect(screen.getByText('Test Children')).toBeInTheDocument();
    expect(screen.getByText('Test Left Sidebar')).toBeInTheDocument();
    expect(screen.getByText('Test Right Sidebar')).toBeInTheDocument();
    expect(document.title).toEqual('Test Page Title');
  });
});
