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
import { renderHook, waitFor } from '@testing-library/react';
import { SupportedLocales } from '../../utils/i18next/LocalUtil.interface';
import { useApplicationStore } from '../useApplicationStore';
import {
  useCurrentUserPreferences,
  usePersistentStorage,
} from './useCurrentUserStore';

// Mock the useApplicationStore
jest.mock('../useApplicationStore', () => ({
  useApplicationStore: jest.fn(),
}));

// Mock the detectBrowserLanguage function
jest.mock('../../utils/i18next/LocalUtil', () => ({
  detectBrowserLanguage: jest.fn(() => 'en-US'),
}));

const mockUseApplicationStore = useApplicationStore as jest.MockedFunction<
  typeof useApplicationStore
>;

describe('useCurrentUserStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Proper store reset
    usePersistentStorage.setState({ preferences: {} });

    // Set up the default mock implementation
    mockUseApplicationStore.mockImplementation((selector) => {
      // Default mock state with type assertion
      const mockState = {
        currentUser: null,
        // Add other properties as needed
      } as any;

      return selector(mockState);
    });
  });

  const defaultPreferences = {
    isSidebarCollapsed: false,
    language: SupportedLocales.English,
    selectedEntityTableColumns: {},
  };

  describe('useCurrentUserPreferences', () => {
    it('should return default preferences when no current user', () => {
      const { result } = renderHook(() => useCurrentUserPreferences());

      expect(result.current.preferences).toEqual(defaultPreferences);
    });

    it('should handle setPreference when no current user', () => {
      const { result } = renderHook(() => useCurrentUserPreferences());

      result.current.setPreference({
        isSidebarCollapsed: true,
        language: SupportedLocales.简体中文,
      });

      // Preferences should remain default since no user
      expect(result.current.preferences).toEqual({
        ...defaultPreferences,
        isSidebarCollapsed: false,
        language: SupportedLocales.English,
      });
    });

    it('should return user preferences when they exist', async () => {
      // Mock currentUser properly
      mockUseApplicationStore.mockImplementation((selector) => {
        const mockState = {
          currentUser: { name: 'testUser' },
        } as any;

        return selector(mockState);
      });

      const { result } = renderHook(() => useCurrentUserPreferences());

      // Set preferences directly through the setPreference method
      await waitFor(async () => {
        result.current.setPreference({
          language: SupportedLocales.简体中文,
        });
      });

      // Direct check without waitFor
      expect(result.current.preferences).toEqual({
        ...defaultPreferences,
        language: SupportedLocales.简体中文,
      });
    });

    it('should spread language key from defaultPreferences for existing user without language preference', async () => {
      // Mock currentUser properly
      mockUseApplicationStore.mockImplementation((selector) => {
        const mockState = {
          currentUser: { name: 'oldUser' },
        } as any;

        return selector(mockState);
      });

      // Simulate an old user who has some preferences but no language key
      // by directly setting the store state (bypassing setPreference which would add language)
      usePersistentStorage.setState({
        preferences: {
          oldUser: {
            isSidebarCollapsed: true,
            selectedEntityTableColumns: { table1: ['col1', 'col2'] },
            // Note: language key is missing - simulating old user data
          } as any,
        },
      });

      const { result } = renderHook(() => useCurrentUserPreferences());

      // Should spread language from defaultPreferences since it's missing
      expect(result.current.preferences).toEqual({
        isSidebarCollapsed: true,
        language: SupportedLocales.English, // From defaultPreferences
        selectedEntityTableColumns: { table1: ['col1', 'col2'] },
      });
    });

    it('should preserve existing language preference when user has it', async () => {
      // Mock currentUser properly
      mockUseApplicationStore.mockImplementation((selector) => {
        const mockState = {
          currentUser: { name: 'userWithLanguage' },
        } as any;

        return selector(mockState);
      });

      // Simulate a user who already has language preference stored
      usePersistentStorage.setState({
        preferences: {
          userWithLanguage: {
            isSidebarCollapsed: false,
            language: SupportedLocales.简体中文,
            selectedEntityTableColumns: {},
          },
        },
      });

      const { result } = renderHook(() => useCurrentUserPreferences());

      // Should preserve the existing language preference
      expect(result.current.preferences).toEqual({
        isSidebarCollapsed: false,
        language: SupportedLocales.简体中文, // User's existing preference preserved
        selectedEntityTableColumns: {},
      });
    });
  });
});
