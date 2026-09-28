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

import { Typography } from '@openmetadata/ui-core-components';
import { AlertCircle, CheckCircle } from '@untitledui/icons';
import { isEmpty, isNil, isUndefined } from 'lodash';
import type { ReactNode } from 'react';
import { EntityType } from '../../../enums/entity.enum';
import { NotificationTemplateValidationResponse } from '../../../generated/api/events/notificationTemplateValidationResponse';
import { NotificationTemplate } from '../../../generated/entity/events/notificationTemplate';
import { t } from '../../../utils/i18next/LocalUtil';

export const getTemplateValidationMessage = (
  message: string,
  color: string,
  icon: ReactNode
) => {
  return (
    <div className="tw:flex tw:items-center tw:gap-2">
      <div>{icon}</div>
      <Typography
        as="p"
        className="tw:text-xs tw:font-medium"
        style={{ color }}>
        {message}
      </Typography>
    </div>
  );
};

export const getTemplateValidationAlert = (
  validationResponse?: NotificationTemplateValidationResponse
) => {
  if (isUndefined(validationResponse)) {
    return null;
  }

  const { isValid, bodyError = '', subjectError = '' } = validationResponse;

  const bgColor = isValid ? '#ecfdf5' : '#fef2f2';
  const color = isValid ? '#047857' : '#b91c1c';
  const icon = isValid ? (
    <CheckCircle color={color} height={14} width={14} />
  ) : (
    <AlertCircle color={color} height={14} width={14} />
  );

  const subjectValidationMessage =
    !isEmpty(subjectError) &&
    !isNil(subjectError) &&
    getTemplateValidationMessage(subjectError, color, icon);
  const bodyValidationMessage =
    !isEmpty(bodyError) &&
    !isNil(bodyError) &&
    getTemplateValidationMessage(bodyError, color, icon);

  const message = isValid ? (
    getTemplateValidationMessage(t('message.template-is-valid'), color, icon)
  ) : (
    <>
      {subjectValidationMessage}
      {bodyValidationMessage}
    </>
  );

  const containerClassName =
    'tw:flex tw:flex-col tw:gap-2 tw:rounded-xl tw:p-3';

  return (
    <div
      className={containerClassName}
      style={{ backgroundColor: bgColor, border: `1px solid ${bgColor}` }}>
      {message}
    </div>
  );
};

export const getTemplateEntityRefObject = (template: NotificationTemplate) => ({
  deleted: template.deleted,
  displayName: template.displayName,
  fullyQualifiedName: template.fullyQualifiedName,
  id: template.id,
  name: template.name,
  type: EntityType.NOTIFICATION_TEMPLATE,
});
