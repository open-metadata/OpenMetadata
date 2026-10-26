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
import { isAxiosError } from 'axios';
import { isEqual } from 'lodash';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CreateOntologyChangeSet } from '../../../generated/api/data/createOntologyChangeSet';
import {
  OntologyChangeSet,
  OntologyChangeSetState,
  OperationStatus,
} from '../../../generated/entity/data/ontologyChangeSet';
import {
  applyOntologyChangeSet,
  createOntologyChangeSet,
  getOntologyChangeSet,
  listOntologyChangeSets,
} from '../../../rest/ontologyAPI';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useOntologyEditLease } from './useOntologyEditLease';

const CHANGE_SET_FIELDS = 'operations,applicationResult';

const validateDraft = (
  draft: OntologyChangeSet,
  plan: CreateOntologyChangeSet
) => {
  const matchesIdentity =
    draft.name === plan.name &&
    draft.ontology?.fullyQualifiedName === plan.ontology &&
    draft.baseWorkingRevision === plan.baseWorkingRevision;
  const matchesOperations =
    isEqual(draft.operations, plan.operations) &&
    draft.undoCursor === (plan.undoCursor ?? plan.operations?.length ?? 0);
  if (!matchesIdentity || !matchesOperations) {
    throw new Error('The retained change set does not match this import.');
  }

  return draft;
};

type ApplyStatus =
  | { kind: 'idle' | 'applied' | 'unchanged' }
  | { kind: 'busy'; step: 'creating' | 'reconciling' | 'leasing' | 'applying' }
  | { kind: 'blocked'; message: string };

interface ApplyAttempt {
  plan: CreateOntologyChangeSet;
  draft?: OntologyChangeSet;
}

export const useOntologyChangeSetApply = ({
  canApply,
  onApplied,
}: {
  canApply: boolean;
  onApplied: () => void;
}) => {
  const { t } = useTranslation();
  const [status, setStatus] = useState<ApplyStatus>({ kind: 'idle' });
  const attempt = useRef<ApplyAttempt>();
  const running = useRef(false);
  const permitted = useRef(canApply);
  permitted.current = canApply;
  const completed = useRef(false);
  const lease = useOntologyEditLease({
    isActive:
      status.kind === 'busy' &&
      (status.step === 'leasing' || status.step === 'applying'),
    resourceId: attempt.current?.draft?.id,
    resourceType: 'ontologyChangeSet',
  });
  const currentLease = useRef(lease);
  currentLease.current = lease;

  const block = useCallback(
    (message = t('server.unexpected-error'), error?: unknown) => {
      running.current = false;
      setStatus({ kind: 'blocked', message });
      if (error) {
        showErrorToast(isAxiosError(error) ? error : message);
      }
    },
    [t]
  );

  const finish = useCallback(
    (draft: OntologyChangeSet, plan: CreateOntologyChangeSet) => {
      validateDraft(draft, plan);
      if (draft.state !== OntologyChangeSetState.Applied) {
        block(
          draft.applicationResult?.results.find(
            (result) => result.status === OperationStatus.Failed
          )?.message
        );

        return;
      }
      running.current = false;
      setStatus({ kind: 'applied' });
      if (!completed.current) {
        completed.current = true;
        onApplied();
      }
    },
    [block, onApplied]
  );

  const recoverDraft = async (plan: CreateOntologyChangeSet) => {
    let after: string | undefined;
    for (let page = 0; page < 100; page++) {
      const response = await listOntologyChangeSets({
        fields: CHANGE_SET_FIELDS,
        limit: 100,
        after,
      });
      const found = response.data.find((draft) => draft.name === plan.name);
      if (found) {
        return validateDraft(found, plan);
      }
      const next = response.paging.after;
      if (!next) {
        return undefined;
      }
      if (response.data.length === 0 || next === after) {
        break;
      }
      after = next;
    }

    throw new Error(
      'Change-set reconciliation did not reach the end of the list.'
    );
  };

  const resolveDraft = async (current: ApplyAttempt, retry: boolean) => {
    if (current.draft) {
      return getOntologyChangeSet(current.draft.id, CHANGE_SET_FIELDS);
    }
    if (retry) {
      const found = await recoverDraft(current.plan);
      if (found) {
        return found;
      }
    }
    if (!permitted.current) {
      throw new Error('Edit permission is required to create the draft.');
    }
    try {
      return await createOntologyChangeSet(current.plan);
    } catch (error) {
      setStatus({ kind: 'busy', step: 'reconciling' });
      const found = await recoverDraft(current.plan);
      if (found) {
        return found;
      }

      throw error;
    }
  };

  const validatePlan = (plan: CreateOntologyChangeSet) => {
    if (
      !plan.ontology ||
      plan.baseWorkingRevision === undefined ||
      plan.glossaries?.length
    ) {
      throw new Error(
        'A native import requires its ontology and working revision.'
      );
    }
  };

  const run = async (current: ApplyAttempt, retry: boolean) => {
    if (running.current || completed.current) {
      return;
    }
    if (!permitted.current) {
      block(t('message.no-permission-for-action'));

      return;
    }
    running.current = true;
    try {
      validatePlan(current.plan);
      if (!current.plan.operations?.length) {
        running.current = false;
        setStatus({ kind: 'unchanged' });

        return;
      }
      setStatus({ kind: 'busy', step: retry ? 'reconciling' : 'creating' });
      current.draft = validateDraft(
        await resolveDraft(current, retry),
        current.plan
      );
      if (current.draft.state === OntologyChangeSetState.Applied) {
        finish(current.draft, current.plan);
      } else if (
        [
          OntologyChangeSetState.Draft,
          OntologyChangeSetState.ApplyFailed,
        ].includes(current.draft.state)
      ) {
        setStatus({ kind: 'busy', step: 'leasing' });
      } else {
        block();
      }
    } catch (error) {
      block(undefined, error);
    }
  };

  useEffect(() => {
    if (status.kind !== 'busy' || status.step !== 'leasing') {
      return;
    }
    if (!canApply) {
      block(t('message.no-permission-for-action'));

      return;
    }
    if (lease.state === 'contended' || lease.state === 'lost') {
      block(
        lease.lock?.holder
          ? t('message.ontology-class-lease-holder', {
              holder: getEntityName(lease.lock.holder),
            })
          : t('message.native-ontology-import-lease-unavailable')
      );

      return;
    }
    const current = attempt.current;
    if (!current?.draft || !lease.isOwned || !lease.lock) {
      return;
    }
    setStatus({ kind: 'busy', step: 'applying' });
    const id = current.draft.id;
    const apply = async () => {
      const draft = validateDraft(
        await getOntologyChangeSet(id, CHANGE_SET_FIELDS),
        current.plan
      );
      if (!permitted.current) {
        block(t('message.no-permission-for-action'));

        return;
      }
      if (
        ![
          OntologyChangeSetState.Draft,
          OntologyChangeSetState.ApplyFailed,
        ].includes(draft.state)
      ) {
        finish(draft, current.plan);

        return;
      }
      const activeLease = currentLease.current;
      if (!activeLease.isOwned || !activeLease.lock) {
        block(t('message.native-ontology-import-lease-unavailable'));

        return;
      }
      finish(
        await applyOntologyChangeSet(id, {
          lease: {
            sessionId: activeLease.lock.sessionId,
            version: activeLease.lock.version,
          },
        }),
        current.plan
      );
    };
    void apply().catch(async (error: unknown) => {
      try {
        const draft = validateDraft(
          await getOntologyChangeSet(id, CHANGE_SET_FIELDS),
          current.plan
        );
        if (draft.state === OntologyChangeSetState.Applied) {
          finish(draft, current.plan);

          return;
        }
      } catch {
        // Retain the same draft when the outcome cannot be read back.
      }
      block(undefined, error);
    });
  }, [
    block,
    canApply,
    finish,
    lease.isOwned,
    lease.lock,
    lease.state,
    status,
    t,
  ]);

  return {
    status,
    configurationLocked:
      Boolean(attempt.current) &&
      status.kind !== 'applied' &&
      status.kind !== 'unchanged',
    start: async (plan: CreateOntologyChangeSet) => {
      if (
        !running.current &&
        (!attempt.current ||
          status.kind === 'applied' ||
          status.kind === 'unchanged')
      ) {
        attempt.current = { plan };
        completed.current = false;
      }
      if (attempt.current) {
        await run(attempt.current, false);
      }
    },
    retry: async () => {
      if (attempt.current) {
        await run(attempt.current, true);
      }
    },
  };
};
