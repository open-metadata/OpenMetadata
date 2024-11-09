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
import { Button, Col, Row, Space, Tooltip, Typography } from 'antd';
import { t } from 'i18next';
import React from 'react';
import { ReactComponent as EditIcon } from '../../../assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from '../../../assets/svg/plus-primary.svg';
import { UserTeamSelectableList } from '../../../components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { DE_ACTIVE_COLOR } from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityType, TabSpecificField } from '../../../enums/entity.enum';
import { Classification } from '../../../generated/entity/classification/classification';
import { Tag } from '../../../generated/entity/classification/tag';
import { EntityReference } from '../../../generated/type/entityReference';
import { getOwnerVersionLabel } from '../../../utils/EntityVersionUtils';
import TagButton from '../../common/TagButton/TagButton.component';

type Props = {
  isVersionView?: boolean;
  permissions: OperationPermission;
  selectedData: Classification;
  isClassification?: boolean;
  entityType: EntityType;
  onUpdate: (data: Classification) => void | Promise<void>;
  onThreadLinkSelect?: (value: string) => void;
  refreshClassificationTags?: () => void;
  editCustomAttributePermission?: boolean;
  onExtensionUpdate?: (updatedTable: Tag) => Promise<void>;
};

const ClassificationDetailsRightPanel = ({
  permissions,
  selectedData,
  onUpdate,
  isVersionView,
  refreshClassificationTags,
}: Props) => {
  const handleUpdatedOwner = async (newOwner?: EntityReference[]) => {
    const updatedData = {
      ...selectedData,
      owners: newOwner,
    };
    await onUpdate(updatedData);
    refreshClassificationTags?.();
  };

  return (
    <Row data-testid="entity-right-panel" gutter={[0, 40]}>
      <Col data-testid="classification-right-panel-owner-link" span="24">
        <div className="d-flex items-center m-b-xs">
          <Typography.Text className="right-panel-label">
            {t('label.owner-plural')}
          </Typography.Text>
          {(permissions.EditOwners || permissions.EditAll) &&
            selectedData.owners &&
            selectedData.owners.length > 0 && (
              <UserTeamSelectableList
                hasPermission={permissions.EditOwners || permissions.EditAll}
                listHeight={200}
                multiple={{ user: true, team: false }}
                owner={selectedData.owners}
                onUpdate={(updatedUser) => handleUpdatedOwner(updatedUser)}>
                <Tooltip
                  title={t('label.edit-entity', {
                    entity: t('label.owner-plural'),
                  })}>
                  <Button
                    className="cursor-pointer flex-center m-l-xss"
                    data-testid="edit-owner"
                    icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                    size="small"
                    type="text"
                  />
                </Tooltip>
              </UserTeamSelectableList>
            )}
        </div>
        <Space className="m-r-xss" size={4}>
          {getOwnerVersionLabel(
            selectedData,
            isVersionView ?? false,
            TabSpecificField.OWNERS,
            permissions.EditOwners || permissions.EditAll
          )}
        </Space>
        {selectedData.owners?.length === 0 &&
          (permissions.EditOwners || permissions.EditAll) && (
            <UserTeamSelectableList
              hasPermission={permissions.EditOwners || permissions.EditAll}
              listHeight={200}
              multiple={{ user: true, team: false }}
              owner={selectedData.owners}
              onUpdate={(updatedUser) => handleUpdatedOwner(updatedUser)}>
              <TagButton
                className="text-primary cursor-pointer"
                dataTestId="add-owner"
                icon={<PlusIcon height={16} name="plus" width={16} />}
                label={t('label.add')}
                tooltip=""
              />
            </UserTeamSelectableList>
          )}
      </Col>
    </Row>
  );
};

export default ClassificationDetailsRightPanel;
