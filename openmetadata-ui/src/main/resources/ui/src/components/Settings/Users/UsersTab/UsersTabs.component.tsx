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
import { Button, Modal, Tooltip } from 'antd';
import { isNil } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconRemove } from '../../../../assets/svg/ic-remove.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../../enums/common.enum';
import { User } from '../../../../generated/entity/teams/user';
import { EntityReference } from '../../../../generated/entity/type';
import { getUserById } from '../../../../rest/userAPI';
import { commonUserDetailColumns } from '../../../../utils/Users.util';
import ErrorPlaceHolder from '../../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../../common/Table/Table';

interface UsersTabProps {
  users: EntityReference[];
  onRemoveUser?: (id: string) => void;
}

export const UsersTab = ({ users, onRemoveUser }: UsersTabProps) => {
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [additionalUsersDetails, setAdditionalUsersDetails] = useState<User[]>(
    []
  );
  const [removeUserDetails, setRemoveUserDetails] =
    useState<{ state: boolean; user: User }>();

  const { t } = useTranslation();

  const handleRemoveButtonClick = useCallback((user: User) => {
    setRemoveUserDetails({
      state: true,
      user,
    });
  }, []);

  const handleRemoveCancel = useCallback(() => {
    setRemoveUserDetails(undefined);
  }, []);

  const handleRemoveConfirm = useCallback(() => {
    if (!isNil(removeUserDetails) && !isNil(onRemoveUser)) {
      onRemoveUser(removeUserDetails.user.id);
    }
    handleRemoveCancel();
  }, [removeUserDetails, handleRemoveCancel]);

  const fetchUsersAdditionalDetails = async () => {
    try {
      setIsDetailsLoading(true);
      const promises = users.map((user) =>
        getUserById(user.id, { fields: 'teams,roles' })
      );

      const usersDetails = await Promise.allSettled(promises);

      const filteredUser = usersDetails
        .filter((user) => user.status === 'fulfilled')
        .map((user) => (user as PromiseFulfilledResult<User>).value);

      setAdditionalUsersDetails(filteredUser);
    } catch (error) {
      // Error
    } finally {
      setIsDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsersAdditionalDetails();
  }, [users]);

  const actionColumn = useMemo(() => {
    return {
      title: t('label.action-plural'),
      dataIndex: 'id',
      key: 'id',
      width: 90,
      render: (_: string, record: User) => {
        return (
          onRemoveUser && (
            <Tooltip
              title={t('label.remove-entity', {
                entity: t('label.user'),
              })}>
              <Button
                data-testid="remove-user-btn"
                icon={
                  <IconRemove height={16} name={t('label.remove')} width={16} />
                }
                type="text"
                onClick={() => handleRemoveButtonClick(record)}
              />
            </Tooltip>
          )
        );
      },
    };
  }, [onRemoveUser]);

  const columns = useMemo(
    () => [...commonUserDetailColumns(isDetailsLoading), actionColumn],
    [isDetailsLoading]
  );

  return (
    <>
      <Table
        bordered
        columns={columns}
        dataSource={
          isDetailsLoading
            ? (users as unknown as User[])
            : additionalUsersDetails
        }
        loading={isDetailsLoading}
        locale={{
          emptyText: (
            <ErrorPlaceHolder
              permission
              className="p-y-md"
              heading={t('label.user')}
              type={ERROR_PLACEHOLDER_TYPE.ASSIGN}
            />
          ),
        }}
        pagination={false}
        rowKey="fullyQualifiedName"
        size="small"
      />
      {Boolean(removeUserDetails?.state) && (
        <Modal
          cancelText={t('label.cancel')}
          data-testid="remove-confirmation-modal"
          okText={t('label.confirm')}
          open={Boolean(removeUserDetails?.state)}
          title={t('label.removing-user')}
          onCancel={handleRemoveCancel}
          onOk={handleRemoveConfirm}>
          {t('message.are-you-sure-want-to-text', {
            text: t('label.remove-entity-lowercase', {
              entity: removeUserDetails?.user.name,
            }),
          })}
        </Modal>
      )}
    </>
  );
};
