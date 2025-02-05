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
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';

export const ENTITY_PERMISSIONS = {
  Create: true,
  Delete: true,
  EditAll: true,
  EditCustomFields: true,
  EditDataProfile: true,
  EditDescription: true,
  EditDisplayName: true,
  EditLineage: true,
  EditOwners: true,
  EditQueries: true,
  EditSampleData: true,
  EditTags: true,
  EditTests: true,
  EditTier: true,
  ViewAll: true,
  ViewBasic: true,
  ViewDataProfile: true,
  ViewQueries: true,
  ViewSampleData: true,
  ViewTests: true,
  ViewUsage: true,
} as OperationPermission;
