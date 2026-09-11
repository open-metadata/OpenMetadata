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
import { ReactNode } from 'react';

export interface DeleteModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Title of the entity being deleted */
  entityTitle: string;
  /** Confirmation message to display */
  message: ReactNode;
  /** Whether the delete action is in progress */
  isDeleting?: boolean;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Callback when delete is confirmed */
  onDelete: () => void;
  /**
   * Raises the overlay's z-index above antd's Drawer/Modal stacking
   * context (@zindex-modal / @zindex-modal-mask, both 1000). Opt-in and
   * off by default so this only affects consumers that actually open the
   * dialog from inside a Drawer - DeleteModal is used across ~75 other
   * call sites that don't need (or want) their stacking changed.
   */
  elevated?: boolean;
}
