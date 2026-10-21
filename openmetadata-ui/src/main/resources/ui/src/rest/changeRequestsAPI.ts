/*
 *  Copyright 2026 Collate.
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
import { PagingResponse } from 'Models';
import { WithdrawChangeRequest } from '../generated/api/governance/withdrawChangeRequest';
import { ApprovalDecision } from '../generated/governance/changeRequest/approvalDecision';
import { ChangeLifecycleEvent } from '../generated/governance/changeRequest/changeLifecycleEvent';
import { ChangeRequest } from '../generated/governance/changeRequest/changeRequest';
import { ChangeRevision } from '../generated/governance/changeRequest/changeRevision';
import APIClient from './axiosClient';

const BASE_URL = '/changeRequests';

/**
 * Change requests on one asset that the caller may see: admins, owners and reviewers see every
 * request, anyone else only their own. Newest first.
 */
export const getChangeRequestsForEntity = async (
  entityId: string,
  limit = 50
): Promise<ChangeRequest[]> => {
  const response = await APIClient.get<PagingResponse<ChangeRequest[]>>(
    BASE_URL,
    { params: { entityId, limit } }
  );

  return response.data.data;
};

/** One change request with its active revision. */
export const getChangeRequest = async (id: string): Promise<ChangeRequest> => {
  const response = await APIClient.get<ChangeRequest>(`${BASE_URL}/${id}`);

  return response.data;
};

/** Withdraw your own pending change request, at the revision you are looking at. */
export const withdrawChangeRequest = async (
  id: string,
  expectedRevision: number
): Promise<ChangeRequest> => {
  const response = await APIClient.post<
    WithdrawChangeRequest,
    AxiosResponse<ChangeRequest>
  >(`${BASE_URL}/${id}/withdraw`, { expectedRevision });

  return response.data;
};

/** Every revision of a change request, oldest first. */
export const getChangeRequestRevisions = async (
  id: string
): Promise<ChangeRevision[]> => {
  const response = await APIClient.get<PagingResponse<ChangeRevision[]>>(
    `${BASE_URL}/${id}/revisions`
  );

  return response.data.data;
};

/** Every review decision recorded on a change request. */
export const getChangeRequestDecisions = async (
  id: string
): Promise<ApprovalDecision[]> => {
  const response = await APIClient.get<PagingResponse<ApprovalDecision[]>>(
    `${BASE_URL}/${id}/decisions`
  );

  return response.data.data;
};

/** The lifecycle history of a change request, in order. */
export const getChangeRequestEvents = async (
  id: string
): Promise<ChangeLifecycleEvent[]> => {
  const response = await APIClient.get<PagingResponse<ChangeLifecycleEvent[]>>(
    `${BASE_URL}/${id}/events`
  );

  return response.data.data;
};
