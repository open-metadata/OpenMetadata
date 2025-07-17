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
import { ExclamationCircleFilled } from '@ant-design/icons';
import { RichTextEditorPreviewerV1 } from '@openmetadata/common-ui';
import { Button, Card, Space, Typography } from 'antd';
import classNames from 'classnames';
import { kebabCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import AppLogo from '../AppLogo/AppLogo.component';
import './application-card.less';
import { ApplicationCardProps } from './ApplicationCard.interface';

const ApplicationCard = ({
  title,
  description,
  className,
  linkTitle,
  onClick,
  appName,
  deleted = false,
  showDescription = true,
}: ApplicationCardProps) => {
  const { t } = useTranslation();

  return (
    <Card
      bordered={false}
      className={classNames(
        className,
        'application-card card-body-border-none'
      )}
      data-testid={`${kebabCase(appName)}-card`}>
      <div className="d-flex items-center gap-3">
        <div className="application-logo">
          <AppLogo appName={appName} />
        </div>
        <Space className="application-info" direction="vertical" size={0}>
          <div className="d-flex gap-2">
            <Typography.Title className="m-0" level={5}>
              {title}
            </Typography.Title>
            {deleted && (
              <div
                className="deleted-badge-button text-xss flex-center"
                data-testid="deleted-badge">
                <ExclamationCircleFilled className="d-flex m-r-xss font-medium text-xs" />
                {t('label.disabled')}
              </div>
            )}
          </div>
          {showDescription && (
            <RichTextEditorPreviewerV1
              className="max-two-lines"
              markdown={description}
            />
          )}
          <Button
            className="p-0"
            data-testid="config-btn"
            type="link"
            onClick={onClick}>
            {linkTitle}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default ApplicationCard;
