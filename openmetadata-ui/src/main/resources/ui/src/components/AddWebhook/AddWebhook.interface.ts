/*
 *  Copyright 2021 Collate
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

import { LoadingState } from 'Models';
import { FormSubmitType } from '../../enums/form.enum';
import { CreateWebhook } from '../../generated/api/events/createWebhook';
import { Webhook } from '../../generated/entity/events/webhook';

export interface AddWebhookProps {
  data?: Webhook;
  header: string;
  mode: FormSubmitType;
  saveState?: LoadingState;
  deleteState?: LoadingState;
  allowAccess?: boolean;
  onCancel: () => void;
  onDelete?: (id: string) => void;
  onSave: (data: CreateWebhook) => void;
}
