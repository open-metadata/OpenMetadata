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

import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { TitleBreadcrumbProps } from '../common/title-breadcrumb/title-breadcrumb.interface';

export interface AddGlossaryProps {
  header: string;
  isLoading: boolean;
  allowAccess?: boolean;
  isTagLoading?: boolean;
  tagList?: string[];
  slashedBreadcrumb: TitleBreadcrumbProps['titleLinks'];
  onCancel: () => void;
  onSave: (data: CreateGlossary) => void;
  fetchTags?: () => void;
}

export enum AddGlossaryError {
  NAME_REQUIRED = 'name required',
  DISPLAY_NAME_REQUIRED = 'display name required',
  NAME_INVALID = 'name invalid',
  DESCRIPTION_REQUIRED = 'description required',
}
