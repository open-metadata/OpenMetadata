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
      className={classNames(
        className,
        'application-card card-body-border-none'
      )}
      bordered={false}>
      <div className="d-flex items-center gap-3">
        <div className="application-logo">
          <AppLogo appName={appName} />
        </div>
        <Space direction="vertical" size={4} className="application-info">
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
