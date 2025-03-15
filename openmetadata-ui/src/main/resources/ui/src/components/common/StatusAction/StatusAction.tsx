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
import Icon from '@ant-design/icons';
import { Button } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CloseCircleIcon } from '../../../assets/svg/close-circle-white.svg';
import { ReactComponent as TickCircleIcon } from '../../../assets/svg/tick-circle-white.svg';
import './status-action.less';

interface StatusActionProps {
  onApprove: () => void;
  onReject: () => void;
  dataTestId?: string;
}

const StatusAction = ({
  onApprove,
  onReject,
  dataTestId,
}: StatusActionProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2">
      <Button
        className="approve-btn"
        data-testid={dataTestId + '-approve-btn'}
        icon={<Icon component={TickCircleIcon} />}
        onClick={onApprove}>
        {t('label.approve')}
      </Button>
      <Button
        className="reject-btn"
        data-testid={dataTestId + '-reject-btn'}
        icon={<Icon component={CloseCircleIcon} />}
        onClick={onReject}
      />
    </div>
  );
};

export default StatusAction;
