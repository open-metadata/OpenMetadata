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
import { ChangeRequest } from '../../../generated/governance/changeRequest/changeRequest';

export interface PendingChangesModalProps {
  /** Open change requests on one asset, in the order they are listed. */
  requests: ChangeRequest[];
  onClose: () => void;
  /** Called after a request is withdrawn, approved or rejected. */
  onChange: () => Promise<void>;
  /** The asset the requests are on, for previewing an edit to it. */
  entityId?: string;
  entityType?: string;
  entityFqn?: string;
  /** Switches to the other view of the same requests; to its preview when {@code preview}. */
  onSwitchView?: (preview?: boolean) => void;
  /** Opens on the preview of an edit to the asset rather than on a request. */
  startWithPreview?: boolean;
}

export interface RequestDetailProps {
  request: ChangeRequest;
  onChange: () => Promise<void>;
}
