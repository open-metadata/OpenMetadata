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
import { Typography } from 'antd';
import { isEmpty } from 'lodash';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconUser } from '../../../assets/svg/user.svg';
import { TERM_ADMIN } from '../../../constants/constants';
import { getEntityName } from '../../../utils/EntityUtils';
import './roles-element.styles.less';
import { RolesElementProps } from './RolesElement.interface';

const RolesElement = ({ userData }: RolesElementProps) => {
  const { t } = useTranslation();

  return (
    <Fragment>
      {userData.isAdmin && (
        <div className="mb-2 d-flex items-center gap-2">
          <Icon component={IconUser} style={{ fontSize: '16px' }} />

          <span>{TERM_ADMIN}</span>
        </div>
      )}
      {userData?.roles?.map((role, i) => (
        <div className="mb-2 d-flex items-center gap-2" key={i}>
          <Icon component={IconUser} style={{ fontSize: '16px' }} />
          <Typography.Text
            className="ant-typography-ellipsis-custom w-48"
            ellipsis={{ tooltip: true }}>
            {getEntityName(role)}
          </Typography.Text>
        </div>
      ))}
      {!userData.isAdmin && isEmpty(userData.roles) && (
        <span className="roles-no-description">
          {t('message.no-roles-assigned')}
        </span>
      )}
    </Fragment>
  );
};

export default RolesElement;
