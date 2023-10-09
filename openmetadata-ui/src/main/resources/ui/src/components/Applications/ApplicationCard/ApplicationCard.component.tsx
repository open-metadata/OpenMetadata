import { Avatar, Button, Card, Space, Typography } from 'antd';
import { ReactComponent as AppIcon } from 'assets/svg/application.svg';
import classNames from 'classnames';
import RichTextEditorPreviewer from '../../../components/common/rich-text-editor/RichTextEditorPreviewer';
import React from 'react';
import { ApplicationCardProps } from './ApplicationCard.interface';

const ApplicationCard = ({
  title,
  description,
  className,
  linkTitle,
  onClick,
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
          <Avatar
            className="flex-center bg-white border"
            size={120}
            icon={<AppIcon color="#000" width={64} height={64} />}
          />
        </div>
        <Space direction="vertical" size={6} className="application-info">
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
