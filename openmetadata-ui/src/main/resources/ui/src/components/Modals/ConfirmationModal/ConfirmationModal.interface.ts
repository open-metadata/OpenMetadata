/*
 *  Copyright 2022 Collate.
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

export interface ConfirmationModalProps {
  className?: string;
  isLoading?: boolean;
  cancelText: string | ReactNode;
  confirmText: string | ReactNode;
  bodyText: string | ReactNode;
  header: string | ReactNode;
  visible: boolean;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  confirmButtonCss?: string;
  cancelButtonCss?: string;
  onConfirm: () => void;
  onCancel: () => void;
}
