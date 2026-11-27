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
import { ExtractedMemoryApproval } from '../../../generated/api/context/extractedMemoryApproval';
import {
  ContextMemory,
  EntityReference,
} from '../../../generated/entity/context/contextMemory';
import { User } from '../../../generated/entity/teams/user';
import { hasEditAccess } from '../../../utils/EntityPermissionUtils';

/**
 * An admin, or an owner of the document, owning teams' members included. Owners a caller did not
 * load (the Documents list) are left to the server, whose preview answers anyone else with 403.
 */
export const canApproveExtractedMemories = (
  currentUser: User | undefined,
  sourceOwners?: EntityReference[]
): boolean =>
  currentUser !== undefined &&
  (Boolean(currentUser.isAdmin) ||
    sourceOwners === undefined ||
    hasEditAccess(sourceOwners, currentUser));

/** The preview selects eligible IDs; the displayed list supplies the versions the person saw. */
export const getDisplayedMemoryApproval = (
  approval: ExtractedMemoryApproval | undefined,
  memories: ContextMemory[]
): ExtractedMemoryApproval | undefined => {
  if (!approval) {
    return undefined;
  }

  const displayed = new Map(memories.map((memory) => [memory.id, memory]));
  const approvable = (approval.approvable ?? []).flatMap(({ id }) => {
    const memory = displayed.get(id);
    const contentUpdatedAt = memory?.lastContentUpdatedAt ?? memory?.updatedAt;

    return contentUpdatedAt === undefined ? [] : [{ id, contentUpdatedAt }];
  });

  return {
    ...approval,
    approved: approvable.length,
    approvable,
    needsDecision: approval.needsDecision.filter(({ id }) => displayed.has(id)),
  };
};

/** The pending memories the approval action names, or 0 when it would approve none of them. */
export const getApprovalPendingCount = (
  approval?: ExtractedMemoryApproval
): number =>
  approval && approval.approved > 0
    ? approval.approved + approval.needsDecision.length
    : 0;
