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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { TestCase } from '../../../generated/tests/testCase';
import { EntityLineageResponse } from '../../../interface/lineage.interface';

export interface UseTestCaseStoreInterface {
  testCase: TestCase | undefined;
  isLoading: boolean;
  isPermissionLoading: boolean;
  showAILearningBanner: boolean;
  testCasePermission: OperationPermission | undefined;
  setTestCasePermission: (
    testCasePermission: OperationPermission | undefined
  ) => void;
  setIsPermissionLoading: (isPermissionLoading: boolean) => void;
  setTestCase: (testCase: TestCase) => void;
  setIsLoading: (isLoading: boolean) => void;
  setShowAILearningBanner: (showBanner: boolean) => void;
  reset: () => void;
  dqLineageData: EntityLineageResponse | undefined;
  setDqLineageData: (data: EntityLineageResponse | undefined) => void;
  isTabExpanded: boolean;
  setIsTabExpanded: (isTabExpanded: boolean) => void;
  /**
   * Timestamp of the run the chart has selected. Held here rather than in the
   * chart because the run-details card is its sibling, not its child.
   * `undefined` means the card follows the most recent run.
   */
  selectedRunTimestamp: number | undefined;
  setSelectedRunTimestamp: (timestamp: number | undefined) => void;
}
export const useTestCaseStore = create<UseTestCaseStoreInterface>()((set) => ({
  testCase: undefined,
  dqLineageData: undefined,
  isLoading: true,
  isPermissionLoading: true,
  showAILearningBanner: false,
  testCasePermission: undefined,
  isTabExpanded: true,
  selectedRunTimestamp: undefined,
  setTestCase: (testCase: TestCase) => {
    set({ testCase });
  },
  setTestCasePermission: (
    testCasePermission: OperationPermission | undefined
  ) => {
    set({ testCasePermission });
  },
  setIsPermissionLoading: (isPermissionLoading: boolean) => {
    set({ isPermissionLoading });
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
  setIsTabExpanded: (isTabExpanded: boolean) => {
    set({ isTabExpanded });
  },
  setSelectedRunTimestamp: (selectedRunTimestamp: number | undefined) => {
    set({ selectedRunTimestamp });
  },
  reset: () => {
    set({
      testCase: undefined,
      isLoading: true,
      showAILearningBanner: false,
      isTabExpanded: true,
      selectedRunTimestamp: undefined,
    });
  },
}));
