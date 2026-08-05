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
import { FormInstance } from 'antd';
import {
  CreateDataProduct,
  DataProductType,
  PortfolioPriority,
  Visibility,
} from '../../../generated/api/domains/createDataProduct';
import {
  CreateDomain,
  DomainType,
} from '../../../generated/api/domains/createDomain';
import { Domain } from '../../../generated/entity/domains/domain';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel } from '../../../generated/type/tagLabel';
import { CoverImageFileValue } from '../../common/CoverImageUpload/CoverImageUpload.interface';
import { DomainFormType } from '../DomainPage.interface';

export interface DomainFormSelectItem {
  id: string;
  label?: string;
  value:
    | TagLabel
    | EntityReference
    | DomainType
    | DataProductType
    | PortfolioPriority
    | Visibility
    | string;
  name?: string;
}

export interface DomainFormValues {
  name: string;
  displayName: string;
  description: string;
  color: string;
  iconURL: string;
  coverImage: CoverImageFileValue | null;
  tags: DomainFormSelectItem[];
  glossaryTerms: TagLabel[];
  owners: DomainFormSelectItem[];
  experts: DomainFormSelectItem[];
  reviewers: DomainFormSelectItem[];
  domainType: DomainFormSelectItem | null;
  domains?: DomainFormSelectItem;
  dataProductType: DomainFormSelectItem | null;
  visibility: DomainFormSelectItem | null;
  portfolioPriority: DomainFormSelectItem | null;
  extension: Record<string, unknown>;
}

export interface AddDomainFormProps {
  isFormInDialog: boolean;
  onCancel: () => void;
  onSubmit: (data: CreateDomain | CreateDataProduct) => Promise<void>;
  formRef?: FormInstance<CreateDomain | CreateDataProduct>;
  loading: boolean;
  type: DomainFormType;
  parentDomain?: Domain; // Optional - present when creating from domain details
}
