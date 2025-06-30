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

import { EntityType } from '../../../enums/entity.enum';
import { APICollection } from '../../../generated/entity/data/apiCollection';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { EntityReference } from '../../../generated/entity/type';
import { TestCase } from '../../../generated/tests/testCase';
import { ServicesType } from '../../../interface/service.interface';
import { VersionData } from '../../../pages/EntityVersionPage/EntityVersionPage.component';
import { TitleBreadcrumbProps } from '../../common/TitleBreadcrumb/TitleBreadcrumb.interface';

export interface DataAssetsVersionHeaderProps {
  breadcrumbLinks: TitleBreadcrumbProps['titleLinks'];
  version?: string;
  deleted: boolean;
  displayName: string;
  serviceName?: string;
  currentVersionData:
    | VersionData
    | ServicesType
    | Database
    | DatabaseSchema
    | APICollection
    | TestCase;
  ownerDisplayName: React.ReactNode[];
  domainDisplayName?: React.ReactNode;
  tierDisplayName: React.ReactNode;
  ownerRef?: EntityReference[];
  onVersionClick: () => void;
  entityType: EntityType;
}
