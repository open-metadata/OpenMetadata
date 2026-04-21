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
import { Button, Space, Tooltip, Typography } from 'antd';
import { ReactComponent as EditIcon } from 'assets/svg/edit-new.svg';
import { ReactComponent as PlusIcon } from 'assets/svg/plus-primary.svg';
import classNames from 'classnames';
import TagButton from 'components/common/TagButton/TagButton.component';
import { UserTeamSelectableList } from 'components/common/UserTeamSelectableList/UserTeamSelectableList.component';
import { DE_ACTIVE_COLOR } from 'constants/constants';
import { OperationPermission } from 'context/PermissionProvider/PermissionProvider.interface';
import { TabSpecificField } from 'enums/entity.enum';
import { Glossary } from 'generated/entity/data/glossary';
import { EntityReference } from 'generated/entity/data/page';
import { KnowledgePage } from 'interface/knowledge-center.interface';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { getOwnerVersionLabel } from 'utils/EntityVersionUtils';

interface KnowledgePageOwnersProps {
  permissions: OperationPermission;
  knowledgePage?: KnowledgePage;
  onOwnerUpdate: (updatedOwners?: EntityReference[]) => Promise<void>;
}

const KnowledgePageOwners: FC<KnowledgePageOwnersProps> = ({
  knowledgePage,
  permissions,
  onOwnerUpdate,
}) => {
  const { t } = useTranslation();
  const hasOwners = knowledgePage?.owners && knowledgePage?.owners.length > 0;
  const canEditOwners = permissions.EditOwners || permissions.EditAll;
  const owners = knowledgePage?.owners ?? [];

  return (
    <Space direction="vertical" size={0}>
      <div
        className={classNames('d-flex items-center', {
          'm-b-xss': hasOwners,
        })}>
        <Typography.Text className="right-panel-label">
          {t('label.owner-plural')}
        </Typography.Text>
        {canEditOwners && (
          <UserTeamSelectableList
            hasPermission={canEditOwners}
            listHeight={200}
            multiple={{ user: true, team: false }}
            owner={owners}
            onUpdate={onOwnerUpdate}>
            {hasOwners ? (
              <Tooltip
                title={t('label.edit-entity', {
                  entity: t('label.owner-plural'),
                })}>
                <Button
                  className="cursor-pointer flex-center m-l-sm"
                  data-testid="edit-owner"
                  icon={<EditIcon color={DE_ACTIVE_COLOR} width="14px" />}
                  size="small"
                  type="text"
                />
              </Tooltip>
            ) : (
              <TagButton
                className="text-primary cursor-pointer m-l-sm"
                dataTestId="add-owner"
                icon={<PlusIcon height={16} name="plus" width={16} />}
                label={t('label.add')}
                tooltip=""
              />
            )}
          </UserTeamSelectableList>
        )}
      </div>
      {hasOwners && (
        <Space className="m-r-xss" size={4}>
          {getOwnerVersionLabel(
            knowledgePage as unknown as Glossary,
            false,
            TabSpecificField.OWNERS,
            canEditOwners
          )}
        </Space>
      )}
    </Space>
  );
};

export default KnowledgePageOwners;
