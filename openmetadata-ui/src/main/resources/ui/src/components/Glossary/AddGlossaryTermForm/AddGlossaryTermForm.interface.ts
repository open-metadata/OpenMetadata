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

import { FormInstance, FormProps } from 'antd';
import { RefObject } from 'react';
import { CreateGlossaryTerm } from '../../../generated/api/data/createGlossaryTerm';
import {
  GlossaryTerm,
  TagLabel,
  TermReference,
} from '../../../generated/entity/data/glossaryTerm';
import {
  CustomProperty,
  EntityReference as GlossaryTermEntityReference,
} from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { EntityReference } from '../../../generated/type/entityLineage';
import { GlossaryTermIntakeFieldsHandle } from './GlossaryTermIntakeFields.component';

export interface AddGlossaryTermFormProps {
  editMode: boolean;
  onSave: (value: GlossaryTermForm) => void | Promise<void>;
  onCancel: () => void;
  glossaryTerm?: GlossaryTerm;
  formRef: FormInstance<CreateGlossaryTerm>;
}

export interface BuildGlossaryTermSavePayloadParams {
  formObj: Parameters<NonNullable<FormProps['onFinish']>>[0];
  editMode: boolean;
  ownersList: GlossaryTermEntityReference[];
  reviewersList: GlossaryTermEntityReference[];
  currentUserId?: string;
  glossaryTerm: GlossaryTerm | undefined;
  extension: Record<string, unknown>;
}

export interface OwnersBadgeProps {
  owners: GlossaryTermEntityReference[];
  testId: string;
}

export interface IntakeFieldsSectionProps {
  editMode: boolean;
  customPropertiesLoaded: boolean;
  extensionFormFields: IntakeFormField[];
  customProperties: CustomProperty[];
  intakeFieldsRef: RefObject<GlossaryTermIntakeFieldsHandle>;
}

export interface GlossaryTermForm {
  name: string;
  displayName: string;
  description: string;
  extension?: Record<string, unknown>;
  reviewers: EntityReference[];
  relatedTerms: string[] | undefined;
  references: TermReference[] | undefined;
  synonyms: string[];
  mutuallyExclusive: boolean;
  tags: TagLabel[];
  owners: EntityReference[];
  style: GlossaryTerm['style'];
}
