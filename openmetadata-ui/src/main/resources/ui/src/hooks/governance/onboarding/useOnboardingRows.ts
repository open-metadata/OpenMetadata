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

import { useEffect, useMemo, useState } from 'react';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import { OnboardingProgress } from '../../../generated/governance/onboarding/onboardingProgress';
import { listOnboarding } from '../../../rest/governance/onboarding/Onboarding.api';
import { getOnboardingPlaybookForEntityType } from '../../../rest/governance/onboarding/OnboardingPlaybook.api';

/** The board's `entityId` filter is capped server-side; a page never shows more than this anyway. */
const MAX_IDS = 100;

export interface OnboardingRows {
  /** The playbook governing this asset type, or undefined when none is configured. */
  playbook?: OnboardingPlaybook;
  /** Progress by entity id. Absent means the asset is not enrolled, not that it is complete. */
  rows: Record<string, OnboardingProgress>;
  isPlaybookLoading: boolean;
  isLoading: boolean;
}

/**
 * Onboarding for the assets a list page is currently showing.
 *
 * <p>One request per page keyed on the page's ids, rather than one per row: a list of 25 rows each
 * fetching its own progress is 25 round trips for a column nobody scrolled to yet.
 */
export const useOnboardingRows = (
  entityType: TargetEntityType,
  ids: string[]
): OnboardingRows => {
  const [playbook, setPlaybook] = useState<OnboardingPlaybook>();
  const [isPlaybookLoading, setIsPlaybookLoading] = useState(true);
  const [rows, setRows] = useState<Record<string, OnboardingProgress>>({});
  const [isLoading, setIsLoading] = useState(false);

  // A stable key so a re-render with the same page does not refetch it.
  const key = useMemo(() => [...ids].sort().join(','), [ids]);
  const hasPlaybook = Boolean(playbook);

  useEffect(() => {
    let isCurrent = true;
    setIsPlaybookLoading(true);
    getOnboardingPlaybookForEntityType(entityType)
      .then((result) => isCurrent && setPlaybook(result))
      .catch(() => isCurrent && setPlaybook(undefined))
      .finally(() => isCurrent && setIsPlaybookLoading(false));

    return () => {
      isCurrent = false;
    };
  }, [entityType]);

  useEffect(() => {
    const entityId = key ? key.split(',').slice(0, MAX_IDS) : [];
    if (!hasPlaybook || entityId.length === 0) {
      setRows({});

      return;
    }
    const controller = new AbortController();
    setIsLoading(true);
    listOnboarding({ entityType, entityId }, controller.signal)
      .then((board) =>
        setRows(
          Object.fromEntries(
            board.data
              .filter((row) => row.entity?.id)
              .map((row) => [row.entity?.id as string, row])
          )
        )
      )
      // A list that cannot show onboarding is still a usable list, so this degrades to blank cells.
      .catch(() => setRows({}))
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [entityType, key, hasPlaybook]);

  return { playbook, rows, isPlaybookLoading, isLoading };
};
