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

import { OnboardingStep } from '../../../generated/entity/governance/onboardingPlaybook';
import { FieldDtype } from '../../../utils/governance/onboarding/OnboardingField.utils';

/** A stage as shown on the lifecycle rail, with the gate counts that govern leaving it. */
export interface PlaybookStageSummary {
  key: string;
  label: string;
  checkCount: number;
  blockingCount: number;
  isEntry: boolean;
  isTerminal: boolean;
}

/** Where a check's answer lives: on the asset, in a custom property, or in a workflow decision. */
export type PlaybookCheckKind = 'native' | 'custom' | 'approval';

/** Something the playbook can ask for, offered when adding a check. */
export interface PlaybookFieldOption {
  /** Stable list key; the field path, or `approval` for the check that is not a field. */
  key: string;
  fieldPath?: string;
  title: string;
  /** The synthetic entries name themselves with an i18n key rather than a field name. */
  isTitleKey?: boolean;
  kind: PlaybookCheckKind;
  dtype: FieldDtype;
  toStep: () => OnboardingStep;
}

/** A check row in the gate editor. */
export interface PlaybookCheckRow {
  step: OnboardingStep;
  index: number;
  isSelected: boolean;
}
