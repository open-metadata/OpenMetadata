/*
 *  Copyright 2023 Collate.
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

import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';
import { EntityType } from '../../enums/entity.enum';
import { ChangeDescription } from '../../generated/entity/type';
import { Paging } from '../../generated/type/paging';
import { ServicesType } from '../../interface/service.interface';
import { ServicePageData } from '../../pages/ServiceDetailsPage/ServiceDetailsPage.interface';

export interface ServiceVersionMainTabContentProps {
  serviceName: string;
  serviceDetails: ServicesType;
  data: ServicePageData[];
  isServiceLoading: boolean;
  paging: Paging;
  currentPage: number;
  pagingHandler: NextPreviousProps['pagingHandler'];
  entityType: EntityType;
  changeDescription: ChangeDescription;
}
