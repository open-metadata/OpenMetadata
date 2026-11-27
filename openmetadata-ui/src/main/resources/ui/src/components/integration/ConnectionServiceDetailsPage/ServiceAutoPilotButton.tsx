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

import {
  Button,
  Tooltip,
  TooltipTrigger,
} from '@openmetadata/ui-core-components';
import { Trigger } from '@openmetadata/ui-core-components/icons';
import { useTranslation } from 'react-i18next';
import { AUTO_PILOT_APP_NAME } from '../../../constants/Applications.constant';
import { EXCLUDE_AUTO_PILOT_SERVICE_TYPES } from '../../../constants/ServiceType.constant';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { ServiceCategory } from '../../../enums/service.enum';
import { Operation } from '../../../generated/entity/policies/policy';
import { useEntityPermissions } from '../../../hooks/useEntityPermissions/useEntityPermissions';
import { AutoPilotAction } from '../../../utils/ExtensionPointTypes';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { getEntityTypeFromServiceCategory } from '../../../utils/ServicePureUtils';

interface ServiceAutoPilotButtonProps {
  autoPilotAction: AutoPilotAction;
  serviceCategory: ServiceCategory;
  servicePermission: OperationPermission;
}

/** The header "Trigger AutoPilot" control, gated as the classic `DataAssetsHeader` gates it. */
const ServiceAutoPilotButton = ({
  autoPilotAction,
  serviceCategory,
  servicePermission,
}: ServiceAutoPilotButtonProps) => {
  const { t } = useTranslation();
  const { can: canAutoPilot } = useEntityPermissions(
    ResourceEntity.APPLICATION,
    AUTO_PILOT_APP_NAME
  );
  const canTrigger =
    getDerivedPermissionFlags(servicePermission).can(Operation.Trigger) &&
    canAutoPilot(Operation.Trigger);
  const isExcluded = EXCLUDE_AUTO_PILOT_SERVICE_TYPES.includes(
    getEntityTypeFromServiceCategory(serviceCategory)
  );

  if (!canTrigger || isExcluded) {
    return null;
  }

  const { onTrigger, isLoading, isDisabled, disabledMessage } = autoPilotAction;

  return (
    <Tooltip
      placement="top"
      title={disabledMessage ?? t('message.trigger-auto-pilot-application')}>
      <TooltipTrigger>
        <Button
          color="primary"
          data-testid="trigger-auto-pilot-application-button"
          iconLeading={Trigger}
          isDisabled={isDisabled}
          isLoading={isLoading}
          size="sm"
          onPress={onTrigger}>
          {t('label.trigger-entity', { entity: t('label.auto-pilot') })}
        </Button>
      </TooltipTrigger>
    </Tooltip>
  );
};

export default ServiceAutoPilotButton;
