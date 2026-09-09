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
import { ReactComponent as IconRetry } from '../../../assets/svg/ic-retry-icon.svg';
import { AIRFLOW_HYBRID } from '../../../constants/constants';
import { useAirflowStatus } from '../../../context/AirflowStatusProvider/AirflowStatusProvider';
import RichTextEditorPreviewerV1 from '../RichTextEditor/RichTextEditorPreviewerV1';
import './airflow-message-banner.less';

interface AirflowMessageBannerProps extends SpaceProps {
  /**
   * Shown when the service is unreachable but the status call carried no `reason` — a thrown call
   * has none. Opt-in and caller-supplied, because what to say depends on what the caller left on
   * screen: the agent tabs keep their lists with disabled controls and have to explain that, while
   * the connection setup and success screens have nothing to explain. Omit to keep the original
   * behaviour of rendering nothing without a `reason`.
   */
  unreachableFallbackMessage?: string;
}

const AirflowMessageBanner: FC<AirflowMessageBannerProps> = ({
  className,
  unreachableFallbackMessage,
}) => {
  const { reason, isAirflowAvailable, isFetchingStatus, platform } =
    useAirflowStatus();

  if (isFetchingStatus) {
    return null;
  }

  // For hybrid runner, always show the banner even if status is 200 — but it has nothing to say
  // without a reason. For other platforms, only show when Airflow is not available.
  if (isAirflowAvailable && (platform !== AIRFLOW_HYBRID || isEmpty(reason))) {
    return null;
  }

  const message = isEmpty(reason) ? unreachableFallbackMessage : reason;

  if (isEmpty(message)) {
    return null;
  }

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
        markdown={message ?? ''}
      />
    </Space>
  );
};

export default AirflowMessageBanner;
