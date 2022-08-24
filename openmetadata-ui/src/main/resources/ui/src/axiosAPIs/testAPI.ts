/*
 *  Copyright 2022 Collate
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

import { TestCase, TestCaseResult } from '../generated/tests/testCase';
import { Include } from '../generated/type/include';
import { Paging } from '../generated/type/paging';
import APIClient from './index';

export type ListTestCaseParams = {
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
  entityLink?: string;
  testSuiteId?: string;
  includeAllTests?: boolean;
  include?: Include;
};

export type ListTestCaseResultsParams = {
  startTs?: number;
  endTs?: number;
  before?: string;
  after?: string;
  limit?: number;
};

const baseUrl = '/testCase';

export const getListTestCase = async (params?: ListTestCaseParams) => {
  const response = await APIClient.get<{ data: TestCase[]; paging: Paging }>(
    baseUrl,
    {
      params,
    }
  );

  return response.data;
};

export const getListTestCaseResults = async (
  fqn: string,
  params?: ListTestCaseResultsParams
) => {
  const url = `${baseUrl}/${fqn}/testCaseResult`;
  const response = await APIClient.get<{
    data: TestCaseResult[];
    paging: Paging;
  }>(url, {
    params,
  });

  return response.data;
};
