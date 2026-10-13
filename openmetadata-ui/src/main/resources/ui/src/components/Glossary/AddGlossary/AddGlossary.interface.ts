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

import { FormSelectItem } from '@openmetadata/ui-core-components';
import { UseFormReturn } from 'react-hook-form';
import { EntityReference } from '../../../generated/entity/type';
import { TagLabel } from '../../../generated/type/tagLabel';

export interface EntityReferenceOption extends FormSelectItem {
  value: EntityReference;
}

export interface GlossaryFormValues {
  name: string;
  displayName: string;
  description: string;
  tags: TagLabel[];
  mutuallyExclusive: boolean;
  owners: EntityReferenceOption[];
  reviewers: EntityReferenceOption[];
  domains: EntityReferenceOption[];
}

export interface AddGlossaryProps {
  form: UseFormReturn<GlossaryFormValues>;
  onSubmit: (data: GlossaryFormValues) => Promise<void> | void;
}
