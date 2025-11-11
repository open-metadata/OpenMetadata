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
import { SxProps, Theme } from '@mui/material';

export interface DeleteModalMUIProps {
  /** Whether the modal is open */
  open: boolean;
  /** Title of the entity being deleted */
  entityTitle: string;
  /** Confirmation message to display */
  message: string;
  /** Whether the delete action is in progress */
  isDeleting?: boolean;
  /** Callback when cancel is clicked */
  onCancel: () => void;
  /** Callback when delete is confirmed */
  onDelete: () => void;
  /** Additional custom styles for the Dialog paper component */
  additionalStyle?: SxProps<Theme>;
}
