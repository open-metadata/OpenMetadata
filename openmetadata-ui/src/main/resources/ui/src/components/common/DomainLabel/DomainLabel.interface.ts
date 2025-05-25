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
import { ReactNode } from 'react';
import { DataAssetWithDomains } from '../../../components/DataAssets/DataAssetsHeader/DataAssetsHeader.interface';
import { EntityType } from '../../../enums/entity.enum';
import { User } from '../../../generated/entity/teams/user';
import { EntityReference } from '../../../generated/entity/type';

export type DomainLabelProps = {
  afterDomainUpdateAction?: (asset: DataAssetWithDomains) => void;
  hasPermission?: boolean;
  domain: EntityReference | EntityReference[] | undefined;
  domainDisplayName?: ReactNode;
  entityType: EntityType;
  entityFqn: string;
  entityId: string;
  textClassName?: string;
  showDomainHeading?: boolean;
  multiple?: boolean;
  onUpdate?: (domain: EntityReference | EntityReference[]) => Promise<void>;
  userData?: User;
  headerLayout?: boolean;
};
