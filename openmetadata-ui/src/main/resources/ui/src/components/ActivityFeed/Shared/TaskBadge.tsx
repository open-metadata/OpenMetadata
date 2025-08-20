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

import Icon from '@ant-design/icons';
import { Space, Tooltip, Typography } from 'antd';
import { isEqual } from 'lodash';
import { useTranslation } from 'react-i18next';
import IconTaskClose from '../../../assets/svg/complete.svg?react';
import IconTaskOpen from '../../../assets/svg/in-progress.svg?react';
import { TEXT_BODY_COLOR } from '../../../constants/constants';
import { ThreadTaskStatus } from '../../../generated/entity/feed/thread';
import './task-badge.less';

const TaskBadge = ({ status }: { status: ThreadTaskStatus }) => {
  const { t } = useTranslation();
  const isTaskOpen = isEqual(status, ThreadTaskStatus.Open);

  const tooltipContent = isTaskOpen
    ? `${t('label.status')}: ${t('label.open-lowercase')}`
    : `${t('label.status')}: ${t('label.closed-lowercase')}`;

  return (
    <Tooltip align={{ targetOffset: [0, -15] }} title={tooltipContent}>
      <Space align="center" className="task-badge" size={4}>
        <Icon
          alt="task-status"
          component={isTaskOpen ? IconTaskOpen : IconTaskClose}
          style={{ fontSize: '12px', color: TEXT_BODY_COLOR }}
        />
        <Typography.Text>{t('label.task')}</Typography.Text>
      </Space>
    </Tooltip>
  );
};

export default TaskBadge;
