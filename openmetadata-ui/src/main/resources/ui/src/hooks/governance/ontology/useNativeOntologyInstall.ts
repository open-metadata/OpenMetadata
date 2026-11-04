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
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { CreateOntology } from '../../../generated/api/data/createOntology';
import { CreateOntologyChangeSet } from '../../../generated/api/data/createOntologyChangeSet';
import type { Ontology } from '../../../generated/entity/data/ontology';
import { getErrorText } from '../../../utils/StringUtils';
import { useEntityPermissions } from '../../useEntityPermissions/useEntityPermissions';
import { useOntologyChangeSetApply } from './useOntologyChangeSetApply';

export type NativeInstallTarget =
  | { kind: 'existing'; ontology: Ontology }
  | { kind: 'new'; request: CreateOntology };

export type NativeInstallOutcome = 'applied' | 'unchanged';

type NativeInstallPhase =
  | 'idle'
  | 'creating'
  | 'permission'
  | 'planning'
  | 'blocked';

interface UseNativeOntologyInstallOptions {
  readonly canCreate: boolean;
  /** Creates the ontology, or finds the one a lost response already made. */
  readonly resolveNew: (
    request: CreateOntology,
    isRetry: boolean
  ) => Promise<Ontology>;
  /** Builds the change set for the resolved target; it must not write. */
  readonly plan: (target: Ontology) => Promise<CreateOntologyChangeSet>;
  readonly onInstalled: (
    ontology: Ontology,
    outcome: NativeInstallOutcome
  ) => void;
}

const BUSY_PHASES: ReadonlySet<NativeInstallPhase> = new Set([
  'creating',
  'permission',
  'planning',
]);

const blockedMessage = (status: { kind: string; message?: string }) =>
  status.kind === 'blocked' ? status.message : undefined;

/**
 * Creates or recovers one target ontology, waits for edit rights on it, plans
 * the change set, and applies it under the edit lease. The first `start`
 * freezes the target, so a retry after a lost response reuses the same create
 * request and finds the ontology it already made.
 */
export const useNativeOntologyInstall = ({
  canCreate,
  resolveNew,
  plan,
  onInstalled,
}: UseNativeOntologyInstallOptions) => {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<NativeInstallPhase>('idle');
  const [target, setTarget] = useState<Ontology>();
  const [error, setError] = useState<string>();
  const attempt = useRef<NativeInstallTarget>();
  const preparing = useRef(false);
  const latest = useRef({ plan, onInstalled });
  latest.current = { plan, onInstalled };

  const {
    canEditAll,
    isLoading: isPermissionLoading,
    error: permissionError,
  } = useEntityPermissions(
    ResourceEntity.ONTOLOGY,
    { id: target?.id ?? '' },
    { enabled: Boolean(target), deleted: target?.deleted }
  );
  const canEditTarget = Boolean(
    target && canEditAll && !isPermissionLoading && !permissionError
  );

  const finish = useCallback(
    (outcome: NativeInstallOutcome) => {
      const wasInstalling = Boolean(attempt.current);
      attempt.current = undefined;
      preparing.current = false;
      setPhase('idle');
      if (wasInstalling && target) {
        latest.current.onInstalled(target, outcome);
      }
    },
    [target]
  );

  const apply = useOntologyChangeSetApply({
    canApply: canEditTarget,
    onApplied: () => finish('applied'),
  });

  const block = useCallback(
    (cause: unknown) => {
      preparing.current = false;
      setPhase('blocked');
      setError(
        isAxiosError(cause)
          ? getErrorText(cause, t('server.unexpected-error'))
          : t('server.unexpected-error')
      );
    },
    [t]
  );

  useEffect(() => {
    if (apply.status.kind === 'unchanged' && attempt.current) {
      finish('unchanged');
    }
  }, [apply.status.kind, finish]);

  useEffect(() => {
    if (phase !== 'permission' || isPermissionLoading || !preparing.current) {
      return;
    }
    if (!target) {
      return;
    }
    if (!canEditTarget) {
      preparing.current = false;
      setPhase('blocked');
      setError(t('message.no-permission-for-action'));

      return;
    }
    preparing.current = false;
    setPhase('planning');
    latest.current
      .plan(target)
      .then(async (changeSet) => {
        setPhase('idle');
        await apply.start(changeSet);
      })
      .catch(block);
  }, [apply, block, canEditTarget, isPermissionLoading, phase, t, target]);

  const resolveTarget = async (frozen: NativeInstallTarget) => {
    if (frozen.kind === 'existing') {
      setTarget(frozen.ontology);

      return;
    }
    if (target) {
      return;
    }
    if (!canCreate) {
      throw new Error('Ontology creation is not permitted.');
    }
    setPhase('creating');
    setTarget(await resolveNew(frozen.request, phase === 'blocked'));
  };

  const start = async (requested: NativeInstallTarget) => {
    if (preparing.current || phase === 'creating' || phase === 'planning') {
      return;
    }
    setError(undefined);
    if (apply.configurationLocked) {
      await apply.retry();

      return;
    }
    attempt.current ??= requested;
    preparing.current = true;
    try {
      await resolveTarget(attempt.current);
      setPhase('permission');
    } catch (cause) {
      block(cause);
    }
  };

  const isBusy = BUSY_PHASES.has(phase) || apply.status.kind === 'busy';

  return {
    start,
    isBusy,
    isLocked: Boolean(attempt.current) || apply.configurationLocked,
    error: error ?? blockedMessage(apply.status),
    target,
  };
};
