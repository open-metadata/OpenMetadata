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
import { EntityLineageResponse } from '../../../components/Lineage/Lineage.interface';
import { TestCase } from '../../../generated/tests/testCase';

export interface UseTestCaseStoreInterface {
  testCase: TestCase | undefined;
  isLoading: boolean;
  showAILearningBanner: boolean;
  setTestCase: (testCase: TestCase) => void;
  setIsLoading: (isLoading: boolean) => void;
  setShowAILearningBanner: (showBanner: boolean) => void;
  reset: () => void;
  dqLineageData: EntityLineageResponse | undefined;
  setDqLineageData: (data: EntityLineageResponse | undefined) => void;
}
export const useTestCaseStore = create<UseTestCaseStoreInterface>()((set) => ({
  testCase: undefined,
  dqLineageData: undefined,
  isLoading: true,
  showAILearningBanner: false,
  setTestCase: (testCase: TestCase) => {
    set({ testCase });
  },
  setIsLoading: (isLoading: boolean) => {
    set({ isLoading });
  },
  setShowAILearningBanner: (showAILearningBanner: boolean) => {
    set({ showAILearningBanner });
  },
  setDqLineageData: (data: EntityLineageResponse | undefined) => {
    set({ dqLineageData: data });
  },
  reset: () => {
    set({ testCase: undefined, isLoading: true, showAILearningBanner: false });
  },
}));
