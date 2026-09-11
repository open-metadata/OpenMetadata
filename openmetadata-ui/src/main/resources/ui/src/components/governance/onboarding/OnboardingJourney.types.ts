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
import { CustomProperty } from '../../../generated/entity/type';
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
  viewer?: OnboardingViewer;
  permissions: OperationPermission;
  loadField: (path: string) => Promise<OnboardingFieldSession>;
  advance: () => Promise<void>;
  refresh: () => Promise<void>;
  busy?: boolean;
  renderApprovalActions?: (result: OnboardingStepResult) => ReactNode;
}
