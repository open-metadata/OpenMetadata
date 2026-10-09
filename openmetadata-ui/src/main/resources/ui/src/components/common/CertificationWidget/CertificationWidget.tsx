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
import { cloneDeep } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '../../../generated/entity/classification/tag';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { updateCertificationTag } from '../../../utils/TagsPureUtils';
import Certification from '../../Certification/Certification.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';
import CertificationTag from '../CertificationTag/CertificationTag';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../WidgetActionButton/WidgetActionButton';
import WidgetCard from '../WidgetCard/WidgetCard';

const CertificationWidget = () => {
  const {
    data: entity,
    permissions,
    onUpdate,
    isVersionView,
  } = useGenericContext<Domain>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  const canEdit = useMemo(
    () =>
      getDerivedPermissionFlags(permissions).can(Operation.EditCertification) &&
      !isVersionView,
    [permissions, isVersionView]
  );

  const handleCertificationUpdate = async (newCertification?: Tag) => {
    try {
      const updatedEntity = cloneDeep(entity);
      updatedEntity.certification = updateCertificationTag(newCertification);
      await onUpdate(updatedEntity);
    } catch {
      // The page-level updater already toasts before rethrowing, so toasting
      // here would duplicate it. Swallow rather than rethrow so Certification's
      // post-await cleanup runs and the popover doesn't stay stuck loading.
    } finally {
      setIsEditing(false);
    }
  };

  const certificationButton = entity.certification ? (
    <WidgetEditButton
      data-testid="edit-certification"
      title={t('label.edit-entity', { entity: t('label.certification') })}
    />
  ) : (
    <WidgetPlusButton
      data-testid="add-certification"
      title={t('label.add-entity', { entity: t('label.certification') })}
    />
  );

  // Anchored to the header button, like the glossary and tag pickers; the
  // button's click opens it through Certification's trigger.
  const headerExtra = canEdit ? (
    <Certification
      currentCertificate={entity.certification?.tagLabel?.tagFQN}
      permission={canEdit}
      popoverProps={{ open: isEditing, onOpenChange: setIsEditing }}
      onCertificationUpdate={handleCertificationUpdate}>
      {certificationButton}
    </Certification>
  ) : null;

  const content = entity.certification && (
    <div data-testid="certification-label">
      <CertificationTag showName certification={entity.certification} />
    </div>
  );

  return (
    <WidgetCard
      dataTestId="certification"
      forceExpand={isEditing}
      headerExtra={headerExtra}
      isExpandDisabled={!entity.certification && !isEditing}
      title={t('label.certification')}>
      {content}
    </WidgetCard>
  );
};

export default CertificationWidget;
