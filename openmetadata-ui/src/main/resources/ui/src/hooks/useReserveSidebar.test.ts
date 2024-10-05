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
import { renderHook } from '@testing-library/react-hooks';
import { useReserveSidebar } from './useReserveSidebar';

describe('useReserveSidebar', () => {
  it('should return false when .floating-button-container is not present', () => {
    const { result } = renderHook(() => useReserveSidebar());

    expect(result.current.isSidebarReserve).toBe(false);
  });

  it('should return true when .floating-button-container is present', () => {
    // Create a mock element and append it to the document body
    const floatingButtonContainer = document.createElement('div');
    floatingButtonContainer.className = 'floating-button-container';
    document.body.appendChild(floatingButtonContainer);

    const { result } = renderHook(() => useReserveSidebar());

    expect(result.current.isSidebarReserve).toBe(true);

    // Clean up the mock element
    document.body.removeChild(floatingButtonContainer);
  });
});
