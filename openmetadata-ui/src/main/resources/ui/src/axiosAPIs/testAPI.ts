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

import { AxiosResponse } from 'axios';
import { Operation } from 'fast-json-patch';
import { TestCase, TestCaseResult } from '../generated/tests/testCase';
import { TestSuite } from '../generated/tests/testSuite';
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

export type ListTestSuitesParam = {
  fields?: string;
  limit?: number;
  before?: string;
  after?: string;
  include?: Include;
};

const testCaseUrl = '/testCase';
const testSuiteUrl = '/testSuite';

export const getListTestCase = async (params?: ListTestCaseParams) => {
  const response = await APIClient.get<{ data: TestCase[]; paging: Paging }>(
    testCaseUrl,
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
  const url = `${testCaseUrl}/${fqn}/testCaseResult`;
  const response = await APIClient.get<{
    data: TestCaseResult[];
    paging: Paging;
  }>(url, {
    params,
  });

  return response.data;
};

export const getListTestSuites = async (params?: ListTestSuitesParam) => {
  const response = await APIClient.get<{
    data: TestSuite[];
    paging: Paging;
  }>(testSuiteUrl, {
    params,
  });

  return response.data;
};

export const getTestSuiteByName = async (
  name: string,
  params?: ListTestCaseParams
) => {
  const response = await APIClient.get<TestSuite>(
    `${testSuiteUrl}/name/${name}`,
    { params }
  );

  return response.data;
};

export const updateTestSuiteById = async (id: string, data: Operation[]) => {
  const configOptions = {
    headers: { 'Content-type': 'application/json-patch+json' },
  };

  const response = await APIClient.patch<Operation[], AxiosResponse<TestSuite>>(
    `${testSuiteUrl}/${id}`,
    data,
    configOptions
  );

  return response.data;
};
