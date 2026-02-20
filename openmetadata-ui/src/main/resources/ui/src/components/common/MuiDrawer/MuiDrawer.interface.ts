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
import { FormInstance } from 'antd';
import { ReactNode } from 'react';

export interface MuiDrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  formRef?: FormInstance;
  isLoading?: boolean;
  isFormInvalid?: boolean;
  submitBtnLabel?: string;
  cancelBtnLabel?: string;
  children: ReactNode;
  headerWidget?: ReactNode;
  sidePanel?: ReactNode;
  hasSidePanel?: boolean;
}
