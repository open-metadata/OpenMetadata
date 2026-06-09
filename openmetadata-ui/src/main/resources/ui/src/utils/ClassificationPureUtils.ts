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
import { EntityField } from '../constants/Feeds.constants';
import type { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { ProviderType } from '../generated/entity/bot';
import type { Classification } from '../generated/entity/classification/classification';
import type { Tag } from '../generated/entity/classification/tag';
import type { ChangeDescription } from '../generated/entity/type';
import { getEntityVersionByField } from './EntityVersionUtils';
import { t } from './i18next/LocalUtil';

export const getDeleteButtonData = (
  record: Tag,
  isClassificationDisabled: boolean,
  classificationPermissions: OperationPermission
) => {
  let disabledDeleteMessage: string = t('message.no-permission-for-action');
  const disableDeleteButton =
    record.provider === ProviderType.System ||
    !classificationPermissions.EditAll ||
    isClassificationDisabled;

  if (isClassificationDisabled) {
    disabledDeleteMessage = t(
      'message.disabled-classification-actions-message'
    );
  } else if (record.provider === ProviderType.System) {
    disabledDeleteMessage = t('message.system-tag-delete-disable-message');
  }

  return { disableDeleteButton, disabledDeleteMessage };
};

export const getClassificationInfo = (
  currentClassification?: Classification,
  isVersionView = false
) => {
  return {
    currentVersion: currentClassification?.version ?? '0.1',
    isClassificationDisabled: currentClassification?.disabled ?? false,
    isClassificationDeleted: currentClassification?.deleted ?? false,
    isTier: currentClassification?.name === 'Tier',
    isSystemClassification:
      currentClassification?.provider === ProviderType.System,
    name: isVersionView
      ? getEntityVersionByField(
          currentClassification?.changeDescription ?? ({} as ChangeDescription),
          EntityField.NAME,
          currentClassification?.name
        )
      : currentClassification?.name,
    displayName: isVersionView
      ? getEntityVersionByField(
          currentClassification?.changeDescription ?? ({} as ChangeDescription),
          EntityField.DISPLAYNAME,
          currentClassification?.displayName
        )
      : currentClassification?.displayName,
    description: isVersionView
      ? getEntityVersionByField(
          currentClassification?.changeDescription ?? ({} as ChangeDescription),
          EntityField.DESCRIPTION,
          currentClassification?.description
        )
      : currentClassification?.description,
  };
};
