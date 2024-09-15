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
import Icon from '@ant-design/icons/lib/components/Icon';
import { Tooltip } from 'antd';
import { ReactComponent as IconKey } from '../../../assets/svg/icon-key.svg';
import SectionLine from '../../../assets/svg/section-line-medium.svg';

import React from 'react';
import { useTranslation } from 'react-i18next';

const PrimaryKeyConstraint = () => {
  const { t } = useTranslation();

  return (
    <div className="constraint-primary-key">
      <img className="primary-key-section-line" src={SectionLine} />
      <Tooltip
        placement="bottom"
        title={t('label.primary-key')}
        trigger="hover">
        <Icon
          alt="primary-key"
          className="primary-key-icon"
          component={IconKey}
        />
      </Tooltip>
    </div>
  );
};

export default PrimaryKeyConstraint;
