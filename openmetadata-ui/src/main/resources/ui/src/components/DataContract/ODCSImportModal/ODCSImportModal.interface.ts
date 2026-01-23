/*
 *  Copyright 2025 Collate.
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

import { ContractImportFormat } from '../../../constants/DataContract.constants';
import { DataContract } from '../../../generated/entity/data/dataContract';

export type ImportMode = 'merge' | 'replace';

export interface ContractImportModalProps {
  visible: boolean;
  entityId: string;
  entityType: string;
  entityName?: string;
  format: ContractImportFormat;
  existingContract?: DataContract | null;
  onClose: () => void;
  onSuccess: (contract: DataContract) => void;
}

export interface ParsedODCSContract {
  name?: string;
  version: string;
  status: string;
  description?: string;
  hasSchema: boolean;
  hasSla: boolean;
  hasSecurity: boolean;
  hasTeam: boolean;
}

export interface ParsedOpenMetadataContract {
  name?: string;
  displayName?: string;
  description?: string;
  hasSchema: boolean;
  hasSla: boolean;
  hasSecurity: boolean;
  hasSemantics: boolean;
}
