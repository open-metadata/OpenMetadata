/*
 *  Copyright 2022 Collate.
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

import Icon from '@ant-design/icons/lib/components/Icon';
import { Card, Typography } from '@openmetadata/ui-core-components';

import { isEmpty } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import { getEntityName } from '../../../utils/EntityNameUtils';
import { InheritedRolesCardProps } from './InheritedRolesCard.interface';

const InheritedRolesCard = ({ userData }: InheritedRolesCardProps) => {
  const { t } = useTranslation();

  return (
    <Card
      className="bot-page-roles-card-header"
      key="inherited-roles-card-component">
      <Card.Header title={t('label.inherited-role-plural')} />
      <Card.Content>
        <Fragment>
          {isEmpty(userData.inheritedRoles) ? (
            <Typography as="p" className="tw:mb-4" color="secondary">
              {t('message.no-inherited-roles-found')}
            </Typography>
          ) : (
            <div className="d-flex justify-between flex-col">
              {userData.inheritedRoles?.map((inheritedRole) => (
                <div
                  className="mb-2 d-flex items-center gap-2"
                  key={inheritedRole.id}>
                  <Icon component={IconUser} style={{ fontSize: '16px' }} />
                  <Typography
                    className="ant-typography-ellipsis-custom w-48"
                    ellipsis={{ tooltip: true }}>
                    {getEntityName(inheritedRole)}
                  </Typography>
                </div>
              ))}
            </div>
          )}
        </Fragment>
      </Card.Content>
    </Card>
  );
};

export default InheritedRolesCard;
