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

import { FC } from 'react';

export type AccessControlView =
  | { type: 'landing' }
  | { type: 'roles' }
  | { type: 'roles-add' }
  | { type: 'roles-detail'; fqn: string; name: string }
  | { type: 'policies' }
  | { type: 'policies-add' }
  | { type: 'policies-detail'; fqn: string; name: string }
  | { type: 'permission-debugger' }
  | { type: 'audit-logs' };

export interface EntityTypeOption {
  label: string;
  value: string;
}

export interface ExportJob {
  error?: string;
  jobId: string;
  message?: string;
  progress?: number;
  status?: string;
  total?: number;
}

export interface LandingCard {
  descriptionKey: string;
  icon: FC<{ className?: string }>;
  id: string;
  titleKey: string;
  view: AccessControlView;
}
