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
import { UpdateOntologyConceptBinding } from '../../../generated/api/data/updateOntologyConceptBinding';
import { EntityReference } from '../../../generated/type/entityReference';
import { OntologyConceptBindingsResponse } from '../../../generated/type/ontologyConceptBindingsResponse';

export type BindingSnapshot = Readonly<
  Pick<OntologyConceptBindingsResponse, 'assets' | 'revision'> & {
    kind: 'complete';
  }
>;

export type ReplaceAsset = Pick<
  UpdateOntologyConceptBinding,
  'asset' | 'expectedRevision'
>;

export type RemoveAsset = Pick<ReplaceAsset['asset'], 'assetId' | 'assetType'> &
  Pick<ReplaceAsset, 'expectedRevision'>;

export type BindingRead =
  | { kind: 'ready'; snapshot: BindingSnapshot }
  | { kind: 'unavailable' };

export type BindingWriteOutcome =
  | { kind: 'confirmed'; read: BindingRead }
  | { kind: 'conflict' }
  | { kind: 'unconfirmed' }
  | { kind: 'not-ready' };

export type NativeBindingBatchOutcome = {
  completedIds: readonly string[];
  remaining: readonly EntityReference[];
  stop: 'none' | 'read-unavailable' | 'conflict' | 'unconfirmed' | 'not-ready';
};
