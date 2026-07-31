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

import { FormInstance } from 'antd';
import React from 'react';
import { CreateGlossaryTerm } from '../../../generated/api/data/createGlossaryTerm';
import {
  GlossaryTerm,
  TagLabel,
  TermReference,
} from '../../../generated/entity/data/glossaryTerm';
import { CustomProperty } from '../../../generated/entity/type';
import { IntakeFormField } from '../../../generated/governance/intakeForm';
import { EntityReference } from '../../../generated/type/entityLineage';
import { GlossaryTermIntakeFieldsHandle } from './GlossaryTermIntakeFields.component';

export interface AddGlossaryTermFormProps {
  editMode: boolean;
  onSave: (value: GlossaryTermForm) => void | Promise<void>;
  onCancel: () => void;
  glossaryTerm?: GlossaryTerm;
  formRef: FormInstance<CreateGlossaryTerm>;
  intakeFieldsRef?: React.RefObject<GlossaryTermIntakeFieldsHandle>;
  /** Custom properties for the glossary term entity type, used for intake form extension fields. */
  intakeCustomProperties?: CustomProperty[];
  /** Intake form extension fields to render alongside the main form. */
  intakeFormFields?: IntakeFormField[];
}

export interface GlossaryTermForm {
  name: string;
  displayName: string;
  description: string;
  reviewers: EntityReference[];
  relatedTerms: string[] | undefined;
  references: TermReference[] | undefined;
  synonyms: string[];
  mutuallyExclusive: boolean;
  tags: TagLabel[];
  owners: EntityReference[];
  style: GlossaryTerm['style'];
}
