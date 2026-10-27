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
import { useQuery } from '@tanstack/react-query';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { Ontology } from '../../../generated/entity/data/ontology';
import {
  Access,
  Operation,
} from '../../../generated/entity/policies/accessControl/resourcePermission';
import { getEntityPermissionById } from '../../../rest/permissionAPI';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getOperationPermissions } from '../../../utils/PermissionsUtils';
import { useApplicationStore } from '../../useApplicationStore';

type UnpublishedCount =
  | { status: 'ready'; count: number }
  | { status: 'loading' | 'unavailable' };

// ADR:2026-10-24-ontology-studio-bounds-tree-windows-and-count-workers
const COUNT_WORKERS = 4;

async function readOwnerUnpublishedCount(
  owner: Ontology,
  signal: AbortSignal
): Promise<number | undefined> {
  const permission = await getEntityPermissionById(
    ResourceEntity.ONTOLOGY,
    owner.id,
    signal
  );
  const access = permission.permissions.find(
    ({ operation }) => operation === Operation.EditAll
  )?.access;
  if (
    ![Access.Allow, Access.Deny, Access.NotAllow].some(
      (known) => known === access
    )
  ) {
    return undefined;
  }
  if (
    !getDerivedPermissionFlags(
      getOperationPermissions(permission),
      owner.deleted
    ).canEditAll
  ) {
    return 0;
  }
  const changes = owner.publicationStatus?.unpublishedChanges;

  return changes !== undefined && Number.isSafeInteger(changes) && changes >= 0
    ? changes
    : undefined;
}

export const useOntologyUnpublishedCount = (
  ontologies: Ontology[],
  enabled: boolean
): UnpublishedCount => {
  const userId = useApplicationStore((store) => store.currentUser?.id);
  const result = useQuery({
    queryKey: [
      'ontology-studio-unpublished-count',
      userId,
      ontologies.map((owner) => [
        owner.id,
        owner.deleted,
        owner.publicationStatus?.unpublishedChanges,
      ]),
    ],
    enabled: enabled && Boolean(userId),
    retry: false,
    gcTime: 0,
    queryFn: async ({ signal }): Promise<UnpublishedCount> => {
      const candidates = ontologies.filter(
        (owner) =>
          !owner.deleted && owner.publicationStatus?.unpublishedChanges !== 0
      );
      let position = 0;
      let count = 0;
      let unavailable = false;
      const worker = async () => {
        while (position < candidates.length && !signal.aborted) {
          const owner = candidates[position++];
          try {
            const changes = await readOwnerUnpublishedCount(owner, signal);
            if (signal.aborted) {
              return;
            }
            if (changes === undefined) {
              unavailable = true;
            } else {
              count += changes;
            }
          } catch {
            if (signal.aborted) {
              return;
            }
            unavailable = true;
          }
        }
      };
      await Promise.all(
        Array.from(
          { length: Math.min(COUNT_WORKERS, candidates.length) },
          worker
        )
      );

      return unavailable || signal.aborted
        ? { status: 'unavailable' }
        : { status: 'ready', count };
    },
  });

  if (result.isError) {
    return { status: 'unavailable' };
  }
  if (!enabled || !userId || result.isPending || result.isFetching) {
    return { status: 'loading' };
  }

  return result.data;
};
