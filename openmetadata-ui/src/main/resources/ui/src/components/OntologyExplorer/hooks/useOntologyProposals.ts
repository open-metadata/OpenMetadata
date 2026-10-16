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

import { AxiosError } from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CreateOntologyChangeSet,
  CreateOntologyChangeSetState,
} from '../../../generated/api/data/createOntologyChangeSet';
import { OntologyEditLeaseToken } from '../../../generated/api/data/ontologyChangeSetCommand';
import { UpdateOntologyChangeSet } from '../../../generated/api/data/updateOntologyChangeSet';
import {
  OntologyChangeSet,
  OntologyChangeSetState,
} from '../../../generated/entity/data/ontologyChangeSet';
import {
  acquireOntologyEditLock,
  applyOntologyChangeSet,
  createOntologyChangeSet,
  discardOntologyChangeSet,
  getOntologyChangeSet,
  listOntologyChangeSets,
  releaseOntologyEditLock,
  replaceOntologyChangeOperations,
} from '../../../rest/ontologyAPI';
import { generateUUID } from '../../../utils/StringUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import {
  EDITABLE_PROPOSAL_STATES,
  getActiveOperations,
  ProposalDecision,
  withoutOperations,
} from '../utils/ontologyProposals';

const CHANGE_SET_FIELDS = 'operations';
const CHANGE_SET_RESOURCE = 'ontologyChangeSet';
const LEASE_SECONDS = 60;
// ponytail: first page only; page through when open drafts outgrow it.
const PAGE_SIZE = 100;

async function withChangeSetLease<T>(
  changeSetId: string,
  run: (lease: OntologyEditLeaseToken) => Promise<T>,
  isReleasedByServer: (result: T) => boolean = () => false
): Promise<T> {
  const sessionId = generateUUID();
  const lock = await acquireOntologyEditLock({
    leaseSeconds: LEASE_SECONDS,
    resourceId: changeSetId,
    resourceType: CHANGE_SET_RESOURCE,
    sessionId,
  });
  let isReleased = false;
  try {
    const result = await run({ sessionId, version: lock.version });
    isReleased = isReleasedByServer(result);

    return result;
  } finally {
    if (!isReleased) {
      await releaseOntologyEditLock(
        CHANGE_SET_RESOURCE,
        changeSetId,
        sessionId
      ).catch(() => undefined);
    }
  }
}

async function retireOperations(
  changeSet: OntologyChangeSet,
  retire: ReadonlySet<string>
): Promise<void> {
  const remaining = withoutOperations(changeSet, retire);
  await withChangeSetLease(changeSet.id, (lease) =>
    remaining.undoCursor === 0
      ? discardOntologyChangeSet(changeSet.id, { lease })
      : replaceOntologyChangeOperations(changeSet.id, {
          lease,
          ...remaining,
        } as UpdateOntologyChangeSet)
  );
}

// A draft is applied or discarded whole, so a decision that covers only part
// of it — or edits an operation — moves into a draft of its own first.
async function applyDecision(
  changeSet: OntologyChangeSet,
  decision: ProposalDecision
): Promise<OntologyChangeSet> {
  const active = getActiveOperations(changeSet);
  const operations = decision.apply.flatMap((id) => {
    const operation =
      decision.edited?.id === id
        ? decision.edited
        : active.find((candidate) => candidate.id === id);

    return operation ? [operation] : [];
  });
  const appliesWholeDraft =
    !decision.edited &&
    operations.length === active.length &&
    active.every((operation) => decision.retire.includes(operation.id));
  let target = changeSet;
  if (!appliesWholeDraft) {
    target = await createOntologyChangeSet({
      description: changeSet.description,
      displayName: changeSet.displayName,
      glossaries: changeSet.glossaries.map(
        (glossary) => glossary.fullyQualifiedName ?? glossary.name ?? ''
      ),
      name: `${changeSet.name}-${decision.apply[0]}`,
      // The entity and create schemas share one operation definition, but the
      // generator emits separate enum types for each.
      operations: operations as CreateOntologyChangeSet['operations'],
      state: CreateOntologyChangeSetState.Draft,
      undoCursor: operations.length,
    });
    await retireOperations(changeSet, new Set(decision.retire));
  }

  // The server drops the lease itself once the change set applies.
  return withChangeSetLease(
    target.id,
    (lease) => applyOntologyChangeSet(target.id, { lease }),
    (applied) => applied.state === OntologyChangeSetState.Applied
  );
}

function applyFailureMessage(changeSet: OntologyChangeSet): string | undefined {
  if (changeSet.state !== OntologyChangeSetState.ApplyFailed) {
    return undefined;
  }

  return changeSet.applicationResult?.results
    .map((result) => result.message)
    .filter(Boolean)
    .join('; ');
}

export const useOntologyProposals = (isEnabled: boolean) => {
  const { t } = useTranslation();
  const [changeSets, setChangeSets] = useState<OntologyChangeSet[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const reload = useCallback(async () => {
    try {
      const page = await listOntologyChangeSets({
        fields: CHANGE_SET_FIELDS,
        limit: PAGE_SIZE,
        state: EDITABLE_PROPOSAL_STATES,
      });
      setChangeSets(page.data);
    } catch {
      // Proposals only overlay the graph; a user who cannot read drafts
      // simply sees none.
      setChangeSets([]);
    }
  }, []);

  useEffect(() => {
    if (isEnabled) {
      void reload();
    } else {
      setChangeSets([]);
    }
  }, [isEnabled, reload]);

  /** Runs decisions in order; stops at the first failure. True if all landed. */
  const run = useCallback(
    async (
      decisions: ProposalDecision[],
      mode: 'apply' | 'reject'
    ): Promise<boolean> => {
      setIsSaving(true);
      try {
        // Each decision re-reads its draft, so a batch never acts on a copy
        // an earlier decision in the same batch already changed.
        for (const decision of decisions) {
          const changeSet = await getOntologyChangeSet(
            decision.changeSetId,
            CHANGE_SET_FIELDS
          );
          if (mode === 'reject') {
            await retireOperations(changeSet, new Set(decision.retire));

            continue;
          }
          const failure = applyFailureMessage(
            await applyDecision(changeSet, decision)
          );
          if (failure !== undefined) {
            showErrorToast(failure || t('server.unexpected-error'));

            return false;
          }
        }

        return true;
      } catch (error) {
        showErrorToast(error as AxiosError);

        return false;
      } finally {
        setIsSaving(false);
        await reload();
      }
    },
    [reload, t]
  );

  const apply = useCallback(
    (decisions: ProposalDecision[]) => run(decisions, 'apply'),
    [run]
  );
  const reject = useCallback(
    (decisions: ProposalDecision[]) => run(decisions, 'reject'),
    [run]
  );

  return { apply, changeSets, isSaving, reject };
};
