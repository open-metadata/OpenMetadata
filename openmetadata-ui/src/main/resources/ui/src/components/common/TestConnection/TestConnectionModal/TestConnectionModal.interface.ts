/*
 *  Copyright 2023 Collate.
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
import { TestConnectionStepResult } from '../../../../generated/entity/automations/workflow';
import { TestConnectionStep } from '../../../../generated/entity/services/connections/testConnectionDefinition';

export interface TestConnectionModalProps {
  isOpen: boolean;
  isTestingConnection: boolean;
  testConnectionStep: TestConnectionStep[];
  testConnectionStepResult: TestConnectionStepResult[];
  progress: number;
  isConnectionTimeout: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onTestConnection: () => void;
  errorMessage?: {
    description?: string;
    subDescription?: string;
  };
  handleCloseErrorMessage: () => void;
  serviceType?: string;
  hostIp?: string;
  connectionType?: string;
  connectionDisplayName?: string;
}

export type ConnectionStepState =
  | 'failed'
  | 'passed'
  | 'queued'
  | 'skipped'
  | 'warning';

export type TranslateFn = (
  key: string,
  options?: Record<string, unknown>
) => string;

export interface ConnectionStepRowProps {
  details: string;
  isExpanded: boolean;
  label: string;
  requiredLabel: string;
  onToggleExpand: () => void;
  state: ConnectionStepState;
  step: TestConnectionStep;
  statusLabel: string;
}
