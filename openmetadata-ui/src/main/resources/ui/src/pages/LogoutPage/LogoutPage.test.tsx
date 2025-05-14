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
import { render } from '@testing-library/react';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { LogoutPage } from './LogoutPage';

// Mock the useApplicationStore hook
jest.mock('../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

describe('LogoutPage', () => {
  const mockOnLogoutHandler = jest.fn();

  beforeEach(() => {
    // Reset mock before each test
    jest.clearAllMocks();

    // Setup mock implementation
    (useApplicationStore as unknown as jest.Mock).mockReturnValue({
      onLogoutHandler: mockOnLogoutHandler,
    });
  });

  it('should call onLogoutHandler on mount', () => {
    render(<LogoutPage />);

    expect(mockOnLogoutHandler).toHaveBeenCalledTimes(1);
  });

  it('should render Loader component with fullScreen prop', () => {
    const { container } = render(<LogoutPage />);
    const loaderElement = container.firstChild;

    expect(loaderElement).toBeInTheDocument();
  });
});
