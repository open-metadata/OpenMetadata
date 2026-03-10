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
import { Typography } from 'antd';
import { AxiosError } from 'axios';
import classNames from 'classnames';
import { cloneDeep } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from '../../../generated/entity/classification/tag';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { getPrioritizedEditPermission } from '../../../utils/PermissionsUtils';
import { updateCertificationTag } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import Certification from '../../Certification/Certification.component';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import CertificationTag from '../CertificationTag/CertificationTag';
import ExpandableCard from '../ExpandableCard/ExpandableCard';
import { EditIconButton } from '../IconButtons/EditIconButton';

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
      getPrioritizedEditPermission(permissions, Operation.EditCertification) &&
      !isVersionView,
    [permissions, isVersionView]
  );

  const handleCertificationUpdate = async (newCertification?: Tag) => {
    try {
      const updatedEntity = cloneDeep(entity);
      updatedEntity.certification = updateCertificationTag(newCertification);
      await onUpdate(updatedEntity);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEditing(false);
    }
  };

  const header = (
    <div className={classNames('d-flex items-center gap-2')}>
      <Typography.Text
        className="text-sm font-medium"
        data-testid="certification-heading-name">
        {t('label.certification')}
      </Typography.Text>
      {canEdit && (
        <EditIconButton
          newLook
          data-testid="edit-certification"
          size="small"
          title={t('label.edit-entity', {
            entity: t('label.certification'),
          })}
          onClick={() => setIsEditing(true)}
        />
      )}
    </div>
  );

  const content = (
    <Certification
      currentCertificate={entity.certification?.tagLabel?.tagFQN}
      permission={canEdit}
      popoverProps={{
        open: isEditing,
        onOpenChange: (visible: boolean) => {
          if (!visible) {
            setIsEditing(false);
          }
        },
      }}
      onCertificationUpdate={handleCertificationUpdate}
      onClose={() => setIsEditing(false)}>
      <div data-testid="certification-label">
        {entity.certification ? (
          <CertificationTag showName certification={entity.certification} />
        ) : (
          <span className="no-data-placeholder">
            {t('label.no-entity-assigned', {
              entity: t('label.certification'),
            })}
          </span>
        )}
      </div>
    </Certification>
  );

  return (
    <ExpandableCard cardProps={{ title: header }} dataTestId="certification">
      {content}
    </ExpandableCard>
  );
};

export default CertificationWidget;
