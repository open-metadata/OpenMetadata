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

import axiosClient from '.';
import { ChangeSource } from '../generated/type/changeSummaryMap';

export interface ChangeSummaryEntry {
  changedAt?: number;
  changedBy?: string;
  changeSource?: ChangeSource;
}

export interface ChangeSummaryResponse {
  changeSummary: Record<string, ChangeSummaryEntry>;
  totalEntries: number;
  offset?: number;
  limit?: number;
}

export interface ChangeSummaryParams {
  fieldPrefix?: string;
  limit?: number;
  offset?: number;
}

const BASE_URL = '/changeSummary';

export const getChangeSummary = async (
  entityType: string,
  entityId: string,
  params?: ChangeSummaryParams
): Promise<ChangeSummaryResponse> => {
  const response = await axiosClient.get<ChangeSummaryResponse>(
    `${BASE_URL}/${entityType}/${entityId}`,
    { params }
  );

  return response.data;
};

export const getChangeSummaryByFqn = async (
  entityType: string,
  fqn: string,
  params?: ChangeSummaryParams
): Promise<ChangeSummaryResponse> => {
  const response = await axiosClient.get<ChangeSummaryResponse>(
    `${BASE_URL}/${entityType}/name/${fqn}`,
    { params }
  );

  return response.data;
};
