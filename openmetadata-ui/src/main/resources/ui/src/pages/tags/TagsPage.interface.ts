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

import { Classification } from 'generated/entity/classification/classification';
import { Tag } from 'generated/entity/classification/tag';
import { LoadingState } from 'Models';

export type DeleteTagDetailsType = {
  id: string;
  name: string;
  categoryName?: string;
  isCategory: boolean;
  status?: LoadingState;
};

export type DeleteTagsType = {
  data: DeleteTagDetailsType | undefined;
  state: boolean;
};

interface SubmitProps {
  name: string;
  description: string;
  displayName: string;
  mutuallyExclusive?: boolean;
}

export interface RenameFormProps {
  visible: boolean;
  onCancel: () => void;
  header: string;
  initialValues?: Tag;
  onSubmit: (value: SubmitProps) => void;
  showMutuallyExclusive?: boolean;
  isClassification?: boolean;
  data?: Classification[];
  isLoading: boolean;
}
