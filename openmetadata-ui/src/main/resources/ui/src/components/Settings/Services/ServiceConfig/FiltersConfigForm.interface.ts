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
import { IChangeEvent } from '@rjsf/core';
import { LoadingState } from 'Models';
import { ServiceCategory } from '../../../../enums/service.enum';
import {
  ConfigData,
  ServicesType,
} from '../../../../interface/service.interface';

export interface FiltersConfigFormProps {
  data?: ServicesType;
  okText?: string;
  cancelText?: string;
  serviceType: string;
  serviceCategory: ServiceCategory;
  status: LoadingState;
  onFocus: (id: string) => void;
  onSave: (data: IChangeEvent<ConfigData>) => Promise<void>;
  onCancel?: () => void;
}
