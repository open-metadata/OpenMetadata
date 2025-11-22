/*
 *  Copyright 2025 Collate.
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
import { Operation } from 'fast-json-patch';
import { InlineAlertProps } from '../components/common/InlineAlert/InlineAlert.interface';
import { User } from '../generated/entity/teams/user';
import { CreateEventSubscription } from '../generated/events/api/createEventSubscription';
import { EventSubscription } from '../generated/events/eventSubscription';
import { ModifiedCreateEventSubscription } from '../pages/AddObservabilityPage/AddObservabilityPage.interface';

export interface HandleAlertSaveProps {
  initialData?: EventSubscription;
  data: ModifiedCreateEventSubscription;
  createAlertAPI: (
    alert: CreateEventSubscription
  ) => Promise<EventSubscription>;
  updateAlertAPI: (id: string, data: Operation[]) => Promise<EventSubscription>;
  afterSaveAction: (fqn: string) => Promise<void>;
  setInlineAlertDetails: (alertDetails?: InlineAlertProps | undefined) => void;
  fqn?: string;
  currentUser?: User;
}
