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
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { getDerivedPermissionFlags } from './PermissionDerivation';

/**
 * The server authorizes creating an agent against its parent service, so a user who manages the
 * service (Create or EditAll on it) can add agents without the global ingestionPipeline Create.
 * The global flag stays as an additional grant for anyone who has it today.
 * ADR:2026-11-12-agent-add-shows-for-service-level-creators
 */
export const canAddAgent = (
  servicePermission?: OperationPermission,
  ingestionPipelinePermission?: OperationPermission
): boolean => {
  const service = servicePermission
    ? getDerivedPermissionFlags(servicePermission)
    : undefined;
  const pipeline = ingestionPipelinePermission
    ? getDerivedPermissionFlags(ingestionPipelinePermission)
    : undefined;

  return Boolean(
    pipeline?.canCreate || service?.canCreate || service?.canEditAll
  );
};
