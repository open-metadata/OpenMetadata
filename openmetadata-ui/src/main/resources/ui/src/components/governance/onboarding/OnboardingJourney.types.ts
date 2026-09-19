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
import { ReactNode } from 'react';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { OnboardingPlaybook } from '../../../generated/entity/governance/onboardingPlaybook';
import { CustomProperty } from '../../../generated/entity/type';
import { TargetEntityType } from '../../../generated/governance/intakeForm';
import {
  OnboardingProgress,
  OnboardingStepResult,
} from '../../../generated/governance/onboarding/onboardingProgress';
import { OnboardingViewer } from '../../../utils/governance/onboarding/OnboardingJourney.utils';

export interface OnboardingFieldSession {
  value: unknown;
  properties: CustomProperty[];
  save: (value: unknown) => Promise<OnboardingStepResult | undefined>;
}

export interface OnboardingJourneyHandle {
  confirmNavigation: (action: () => void) => void;
  isDirty: () => boolean;
}

export interface OnboardingJourneyProps {
  progress: OnboardingProgress;
  entityType: TargetEntityType;
  viewer?: OnboardingViewer;
  permissions: OperationPermission;
  loadField: (path: string) => Promise<OnboardingFieldSession>;
  advance: () => Promise<void>;
  refresh: () => Promise<void>;
  busy?: boolean;
  /** The playbook the asset follows, for the names and the gate the wizard talks about. */
  playbook?: OnboardingPlaybook | null;
  /** The check the caller wants opened first, from the list page's `Continue setup` link. */
  initialStepId?: string;
  /** Remind whoever holds a check that it is still open. */
  onNudge?: (stepId: string) => Promise<void>;
  /** The transition just succeeded in this session, so the hand-off summary replaces the wizard. */
  justSubmitted?: boolean;
  /**
   * The stage the producer asked for. The asset reaches it when the gate's workflow says so, which
   * can be after the response lands, so the summary names what was asked for rather than what the
   * server has got round to.
   */
  submittedStage?: string;
  /** The builder's preview simulates decisions the real wizard leaves to the workflow. */
  renderApprovalActions?: (result: OnboardingStepResult) => ReactNode;
  /**
   * Keep checks an earlier gate has already passed in the list. The producer's wizard hides them -
   * they are history - but the builder's preview walks the whole lifecycle and needs to show what
   * each earlier stage asked for.
   */
  includeCompletedHistory?: boolean;
}
