/*
 *  Copyright 2024 Collate.
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
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { TabSpecificField } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type';
import { ChangeDescription } from '../../../generated/type/changeEvent';
import { getOwnerVersionLabel } from '../../../utils/EntityVersionUtils';
import { UserTeamSelectableList } from '../../common/UserTeamSelectableList/UserTeamSelectableList.component';
import {
  WidgetEditButton,
  WidgetPlusButton,
} from '../../common/WidgetActionButton/WidgetActionButton';
import WidgetCard from '../../common/WidgetCard/WidgetCard';
import { useGenericContext } from '../../Customization/GenericProvider/GenericContext';

export const ReviewerLabelV2 = <
  T extends {
    reviewers?: EntityReference[];
    id: string;
    changeDescription?: ChangeDescription;
  }
>() => {
  const { data, onUpdate, permissions, isVersionView } = useGenericContext<T>();
  const { t } = useTranslation();

  const hasEditReviewerAccess = useMemo(() => {
    return permissions.EditAll || permissions.EditReviewers;
  }, [permissions]);

  const { assignedReviewers, hasReviewers } = useMemo(() => {
    const inheritedReviewers: EntityReference[] = [];
    const assignedReviewers: EntityReference[] = [];

    data.reviewers?.forEach((item) => {
      if (item.inherited) {
        inheritedReviewers.push(item);
      } else {
        assignedReviewers.push(item);
      }
    });

    return {
      inheritedReviewers,
      assignedReviewers,
      hasReviewers: data.reviewers && data.reviewers.length > 0,
    };
  }, [data.reviewers]);

  const handleReviewerSave = async (updatedReviewers?: EntityReference[]) => {
    const updatedEntity = { ...data };
    updatedEntity.reviewers = updatedReviewers;
    await onUpdate(updatedEntity);
  };

  const headerExtra = useMemo(
    () =>
      hasEditReviewerAccess ? (
        <UserTeamSelectableList
          previewSelected
          hasPermission={hasEditReviewerAccess}
          label={t('label.reviewer-plural')}
          listHeight={200}
          multiple={{ user: true, team: false }}
          owner={assignedReviewers ?? []}
          popoverProps={{ placement: 'topLeft' }}
          onUpdate={handleReviewerSave}>
          {hasReviewers ? (
            <WidgetEditButton
              data-testid="edit-reviewer-button"
              title={t('label.edit-entity', {
                entity: t('label.reviewer-plural'),
              })}
            />
          ) : (
            <WidgetPlusButton
              data-testid="Add"
              title={t('label.add-entity', {
                entity: t('label.reviewer-plural'),
              })}
            />
          )}
        </UserTeamSelectableList>
      ) : null,
    [data, permissions, handleReviewerSave]
  );

  return (
    <WidgetCard
      dataTestId="glossary-reviewer"
      headerExtra={headerExtra}
      isExpandDisabled={!hasReviewers}
      title={t('label.reviewer-plural')}>
      {hasReviewers ? (
        <div data-testid="glossary-reviewer-name">
          {getOwnerVersionLabel(
            data,
            isVersionView ?? false,
            TabSpecificField.REVIEWERS,
            hasEditReviewerAccess
          )}
        </div>
      ) : null}
    </WidgetCard>
  );
};
