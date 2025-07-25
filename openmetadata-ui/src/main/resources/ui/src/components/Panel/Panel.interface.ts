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

export type PanelPlacement = 'left' | 'right' | 'top' | 'bottom';

export interface PanelProps {
  /**
   * Whether the panel is open/visible
   */
  open: boolean;

  /**
   * Callback fired when the panel is closed
   */
  onClose: () => void;

  /**
   * Panel title
   */
  title: string;

  /**
   * Optional panel description/subtitle
   */
  description?: string;

  /**
   * Panel placement position
   * @default 'right'
   */
  placement?: PanelPlacement;

  /**
   * Panel width (for left/right placement) or height (for top/bottom placement)
   * @default 720
   */
  size?: number | string;

  /**
   * Panel content
   */
  children: ReactNode;

  /**
   * Optional footer content (typically action buttons)
   */
  footer?: ReactNode;

  /**
   * Whether to show the close button
   * @default true
   */
  closable?: boolean;

  /**
   * Whether to show mask
   * @default true
   */
  mask?: boolean;

  /**
   * Whether clicking mask can close the panel
   * @default true
   */
  maskClosable?: boolean;

  /**
   * Additional CSS class name
   */
  className?: string;

  /**
   * Test ID for testing
   */
  'data-testid'?: string;

  /**
   * Label for the Cancel button
   * @default 'Cancel'
   */
  cancelLabel?: string;

  /**
   * Label for the Save button
   * @default 'Save'
   */
  saveLabel?: string;

  /**
   * Callback fired when the Cancel button is clicked
   * @default onClose
   */
  onCancel?: () => void;

  /**
   * Callback fired when the Save button is clicked
   */
  onSave?: () => void;

  /**
   * Whether the Save button is loading
   * @default false
   */
  saveLoading?: boolean;

  /**
   * Whether the Save button is disabled
   * @default false
   */
  saveDisabled?: boolean;

  /**
   * Whether pressing ESC key can close the panel
   * @default true
   */
  allowCloseOnEsc?: boolean;
}
