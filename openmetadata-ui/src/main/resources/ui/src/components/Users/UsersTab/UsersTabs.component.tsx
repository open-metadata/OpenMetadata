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
import Icon from '@ant-design/icons';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseIcon } from '../../../assets/svg/ic-delete.svg';
import { ERROR_PLACEHOLDER_TYPE } from '../../../enums/common.enum';
import { User } from '../../../generated/entity/teams/user';
import { EntityReference } from '../../../generated/entity/type';
import { getUserById } from '../../../rest/userAPI';
import { commonUserDetailColumns } from '../../../utils/Users.util';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Table from '../../common/Table/Table';

interface UsersTabProps {
  users: EntityReference[];
  onRemoveUser?: (id: string) => void;
}

export const UsersTab = ({ users, onRemoveUser }: UsersTabProps) => {
  const [isDetailsLoading, setIsDetailsLoading] = useState(true);
  const [additionalUsersDetails, setAdditionalUsersDetails] = useState<User[]>(
    []
  );

  const { t } = useTranslation();

  const fetchUsersAdditionalDetails = async () => {
    try {
      setIsDetailsLoading(true);
      const promises = users.map((user) => getUserById(user.id, 'teams,roles'));

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
      render: (id: string) => {
        return (
          onRemoveUser && (
            <Icon
              component={CloseIcon}
              data-testid="remove-user-button"
              title={t('label.remove')}
              onClick={() => onRemoveUser(id)}
            />
          )
        );
      },
    };
  }, []);

  const columns = useMemo(
    () => [...commonUserDetailColumns(isDetailsLoading), actionColumn],
    [isDetailsLoading]
  );

  return (
    <Table
      bordered
      columns={columns}
      dataSource={
        isDetailsLoading ? (users as unknown as User[]) : additionalUsersDetails
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
  );
};
