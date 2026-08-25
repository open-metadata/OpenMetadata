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
import { ServiceCategoryParam } from '../../../../../constants/ServiceType.constant';
import { ServiceCategory } from '../../../../../enums/service.enum';

export type SelectServiceTypeProps = {
  showError: boolean;
  /**
   * May be the `all` sentinel, in which case the step shows every category's connectors in one
   * grid with no category pre-selected (reached from a category-agnostic Add Service entry point).
   */
  serviceCategory: ServiceCategoryParam;
  /** Also receives the `all` sentinel, which the category dropdown offers alongside real categories. */
  serviceCategoryHandler: (category: ServiceCategoryParam) => void;
  /**
   * `category` is the category the clicked connector belongs to — the same as `serviceCategory`
   * for a single-category grid, but any category when the flattened `all` grid is showing.
   */
  handleServiceTypeClick: (type: string, category: ServiceCategory) => void;
};
