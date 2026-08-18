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
import { Space, SpaceProps } from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as IconRetry } from '../../../assets/svg/ic-retry-icon.svg';
import { AIRFLOW_HYBRID } from '../../../constants/constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import './airflow-message-banner.less';

const AirflowMessageBanner: FC<SpaceProps> = ({ className }) => {
  const { t } = useTranslation();
  const { reason, isAirflowAvailable, isFetchingStatus, platform } =
    useAirflowStatus();

  if (isFetchingStatus) {
    return null;
  }

  // For hybrid runner, always show the banner even if status is 200 — but it has nothing to say
  // without a reason. For other platforms, only show when Airflow is not available.
  if (isAirflowAvailable) {
    if (platform !== AIRFLOW_HYBRID || isEmpty(reason)) {
      return null;
    }
  }

  // A status call that threw carries no reason, and the agent lists below now stay on screen with
  // their controls disabled — without a fallback that reads as an unexplained dead UI.
  const message = isEmpty(reason)
    ? t('message.pipeline-service-unreachable-agent-actions')
    : reason ?? '';

  return (
    <Space
      align="center"
      className={classNames('airflow-message-banner', className)}
      data-testid="no-airflow-placeholder"
      role="status"
      size={16}>
      <IconRetry className="align-middle" height={24} width={24} />
      <RichTextEditorPreviewerV1
        enableSeeMoreVariant={false}
        markdown={message}
      />
    </Space>
  );
};

export default AirflowMessageBanner;
