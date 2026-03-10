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
import { TAG_START_WITH } from '../../../constants/Tag.constants';
import { Tag } from '../../../generated/entity/classification/tag';
import { Domain } from '../../../generated/entity/domains/domain';
import { Operation } from '../../../generated/entity/policies/policy';
import { TagLabel } from '../../../generated/type/tagLabel';
import { getPrioritizedEditPermission } from '../../../utils/PermissionsUtils';
import { getTierTags } from '../../../utils/TableUtils';
import { updateTierTag } from '../../../utils/TagsUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { useGenericContext } from '../../Customization/GenericProvider/GenericProvider';
import TagsV1 from '../../Tag/TagsV1/TagsV1.component';
import ExpandableCard from '../ExpandableCard/ExpandableCard';
import { EditIconButton } from '../IconButtons/EditIconButton';
import TierCard from '../TierCard/TierCard';
import './TierWidget.less';

const TierWidget = () => {
  const {
    data: entity,
    permissions,
    onUpdate,
    isVersionView,
  } = useGenericContext<Domain>();
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);

  const tier = useMemo(
    () => getTierTags((entity.tags ?? []) as TagLabel[]),
    [entity.tags]
  );

  const handleTierUpdate = async (selectedTier?: Tag) => {
    try {
      const updatedTags = updateTierTag(
        (entity.tags ?? []) as TagLabel[],
        selectedTier
      );
      const updatedEntity = cloneDeep(entity);
      updatedEntity.tags = updatedTags;
      await onUpdate(updatedEntity);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsEditing(false);
    }
  };

  const canEdit = useMemo(
    () =>
      getPrioritizedEditPermission(permissions, Operation.EditTier) &&
      !isVersionView,
    [permissions, isVersionView]
  );

  const header = (
    <div className={classNames('d-flex items-center gap-2')}>
      <Typography.Text
        className="text-sm font-medium"
        data-testid="tier-heading-name">
        {t('label.tier')}
      </Typography.Text>
      {canEdit && (
        <EditIconButton
          newLook
          data-testid="edit-tier"
          size="small"
          title={t('label.edit-entity', {
            entity: t('label.tier'),
          })}
          onClick={() => setIsEditing(true)}
        />
      )}
    </div>
  );

  const tierDisplay = tier ? (
    <TagsV1
      hideIcon
      startWith={TAG_START_WITH.SOURCE_ICON}
      tag={tier}
      tagProps={{ 'data-testid': 'Tier' }}
    />
  ) : (
    <span className="no-data-placeholder" data-testid="Tier">
      {t('label.no-entity-assigned', {
        entity: t('label.tier'),
      })}
    </span>
  );

  const content = isEditing ? (
    <TierCard
      currentTier={tier?.tagFQN}
      footerActionButtonsClassName="p-x-md"
      popoverProps={{
        open: true,
        onOpenChange: (visible: boolean) => {
          if (!visible) {
            setIsEditing(false);
          }
        },
      }}
      tierCardClassName="tier-widget-popover"
      updateTier={handleTierUpdate}
      onClose={() => setIsEditing(false)}>
      <div data-testid="tier-selector-display">{tierDisplay}</div>
    </TierCard>
  ) : (
    tierDisplay
  );

  return (
    <ExpandableCard cardProps={{ title: header }} dataTestId="tier">
      {content}
    </ExpandableCard>
  );
};

export default TierWidget;
