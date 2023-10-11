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
import { Button, Card, Space, Typography } from 'antd';
import classNames from 'classnames';
import React from 'react';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import AppLogo from '../AppLogo/AppLogo.component';
import { ApplicationCardProps } from './ApplicationCard.interface';

const ApplicationCard = ({
  title,
  description,
  className,
  linkTitle,
  onClick,
  appName,
}: ApplicationCardProps) => {
  return (
    <Card
      bordered={false}
      className={classNames(
        className,
        'application-card card-body-border-none'
      )}>
      <div className="d-flex items-center gap-3">
        <div className="application-logo">
          <AppLogo appName={appName} />
        </div>
        <Space className="application-info" direction="vertical" size={4}>
          <Typography.Title className="m-0" level={5}>
            {title}
          </Typography.Title>
          <RichTextEditorPreviewer
            className="max-two-lines"
            markdown={description}
          />
          <Button className="p-0" type="link" onClick={onClick}>
            {linkTitle}
          </Button>
        </Space>
      </div>
    </Card>
  );
};

export default ApplicationCard;
