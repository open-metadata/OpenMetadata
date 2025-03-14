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

import { ServiceCategory } from '../../../../../enums/service.enum';
import { ServiceConfig } from '../../../../../pages/AddServicePage/AddServicePage.interface';

export type SelectServiceTypeProps = {
  showError: boolean;
  serviceCategory: ServiceCategory;
  serviceCategoryHandler: (category: ServiceCategory) => void;
  selectServiceType: string;
  handleServiceTypeClick: (type: string) => void;
  onCancel: () => void;
  onNext: () => void;
};

export type ConfigureServiceProps = {
  serviceName: string;
  onBack: () => void;
  onNext: (data: Pick<ServiceConfig, 'name' | 'description'>) => void;
};
