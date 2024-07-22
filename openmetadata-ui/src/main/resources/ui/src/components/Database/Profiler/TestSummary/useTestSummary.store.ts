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
import { create } from 'zustand';
import { TestSummary } from '../../../../generated/tests/testSuite';
import { getTestCaseExecutionSummary } from '../../../../rest/testAPI';

interface TestSummaryState {
  testSummaries: Record<string, TestSummary | undefined>;
  fetchTestSummary: (id: string) => Promise<void>;
  getTestSummaryById: (id: string) => Promise<TestSummary | undefined>;
}

export const useTestSummaryStore = create<TestSummaryState>((set, get) => ({
  testSummaries: {},

  fetchTestSummary: async (id: string) => {
    try {
      const testSummary = await getTestCaseExecutionSummary(id);
      // Update the test summary
      set((state) => ({
        testSummaries: {
          ...state.testSummaries,
          [id]: testSummary,
        },
      }));
    } catch (error) {
      set((state) => ({
        testSummaries: {
          ...state.testSummaries,
          [id]: undefined,
        },
      }));
    }
  },

  getTestSummaryById: async (id: string, refresh = false) => {
    const summary = get().testSummaries[id];
    if (!summary || refresh) {
      await get().fetchTestSummary(id);

      return get().testSummaries[id];
    }

    return summary;
  },
}));
