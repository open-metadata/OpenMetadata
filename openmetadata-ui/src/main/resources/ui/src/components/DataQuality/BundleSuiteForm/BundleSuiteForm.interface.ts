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

import { DrawerProps } from 'antd';
import { ReactNode } from 'react';
import { TestCase } from '../../../generated/tests/testCase';
import { TestSuite } from '../../../generated/tests/testSuite';
import { AddTestCaseListChangePayload } from '../AddTestCaseList/AddTestCaseList.interface';

export interface BundleSuiteFormProps {
  drawerProps?: DrawerProps;
  className?: string;
  onCancel?: () => void;
  onSuccess?: (testSuite: TestSuite) => void;
  initialValues?: {
    name?: string;
    description?: string;
    testCases?: TestCase[];
  };
}

export interface BundleSuiteFormDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: (testSuite: TestSuite) => void;
  initialValues?: BundleSuiteFormProps['initialValues'];
  /**
   * Reserved for AI-mode chrome (Phase 7). Accepted on the props so callers
   * (including the AI flow) can pass it, but it does not yet change rendering,
   * so the implementation intentionally does not destructure it.
   */
  variant?: 'classic' | 'ai';
  title?: ReactNode;
  headerActions?: ReactNode;
  width?: number | string;
}

export type BundleSuiteFormData = {
  name: string;
  description?: string;
  testCaseSelection: AddTestCaseListChangePayload;
  enableScheduler?: boolean;
  cron?: string;
  enableDebugLog?: boolean;
  raiseOnError?: boolean;
  pipelineName?: string;
};
