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
import { Button, Card, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { kebabCase } from 'lodash';
import { useTranslation } from 'react-i18next';
import RichTextEditorPreviewerNew from '../../../common/RichTextEditor/RichTextEditorPreviewNew';
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
  disabled = false,
  disabledReason,
  showDescription = true,
}: ApplicationCardProps) => {
  const { t } = useTranslation();
  const isUnavailable = deleted || disabled;

  const card = (
    <Card
      bordered={false}
      className={classNames(
        className,
        'application-card card-body-border-none',
        {
          'application-card-disabled': isUnavailable,
          'tw:cursor-pointer tw:transition-shadow tw:hover:shadow-xl':
            !isUnavailable && Boolean(onClick),
        }
      )}
      data-testid={`${kebabCase(appName)}-card`}
      onClick={!isUnavailable ? onClick : undefined}>
      <div className="d-flex items-center gap-3">
        <div className="application-logo">
          <AppLogo appName={appName} />
        </div>
        <div className="application-info">
          <div className="d-flex gap-2">
            <Typography.Title className="m-0" level={5}>
              {title}
            </Typography.Title>
            {isUnavailable && (
              <div
                className="deleted-badge-button text-xss flex-center"
                data-testid="deleted-badge">
                <ExclamationCircleFilled className="d-flex m-r-xss font-medium text-xs" />
                {t('label.disabled')}
              </div>
            )}
          </div>
          {showDescription && (
            <RichTextEditorPreviewerNew
              enableSeeMoreVariant={false}
              markdown={description}
            />
          )}
          <Button className="p-0" data-testid="config-btn" type="link">
            {linkTitle}
          </Button>
        </div>
      </div>
    </Card>
  );

  if (disabledReason) {
    return (
      <Tooltip title={disabledReason}>
        <div className="h-full">{card}</div>
      </Tooltip>
    );
  }

  return card;
};

export default ApplicationCard;
