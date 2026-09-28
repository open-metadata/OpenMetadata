/*
 *  Copyright 2026 Collate.
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

import { Card } from '@openmetadata/ui-core-components';
import Description from '../../../components/common/EntityDescription/Description';
import { EntityType } from '../../../enums/entity.enum';
import { EventSubscription } from '../../../generated/events/eventSubscription';
import { ALERT_AI_FORM_CLASS_NAMES } from './AlertAiFormFields.constants';

interface AlertDescriptionCardProps {
  alertDetails?: EventSubscription;
  hasEditAccess: boolean;
  onDescriptionUpdate: (description: string) => Promise<void>;
}

/** Renders the editable alert description card shown above the configuration tab content. */
const AlertDescriptionCard = ({
  alertDetails,
  hasEditAccess,
  onDescriptionUpdate,
}: AlertDescriptionCardProps) => (
  <Card
    className={ALERT_AI_FORM_CLASS_NAMES.alertDescriptionCard}
    data-testid="alert-description">
    <Description
      description={alertDetails?.description}
      entityType={EntityType.EVENT_SUBSCRIPTION}
      hasEditAccess={hasEditAccess}
      showCommentsIcon={false}
      onDescriptionUpdate={onDescriptionUpdate}
    />
  </Card>
);

export default AlertDescriptionCard;
