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
import { render, screen } from '@testing-library/react';
import KnowledgeCenterLayout from './KnowledgeCenterLayout';

jest.mock('components/common/DocumentTitle/DocumentTitle', () =>
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
