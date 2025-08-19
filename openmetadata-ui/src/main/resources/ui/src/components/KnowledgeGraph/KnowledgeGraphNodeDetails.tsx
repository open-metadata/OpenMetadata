/*
 *  Copyright 2024 Collate.
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

import {
  AppstoreOutlined,
  BankOutlined,
  BookOutlined,
  CloseOutlined,
  ContainerOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  FolderOutlined,
  ForkOutlined,
  LinkOutlined,
  MailOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  TableOutlined,
  TagsOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Button, Divider, Space, Tag, Typography } from 'antd';
import React from 'react';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface NodeDetailsProps {
  node: {
    id: string;
    label: string;
    name?: string;
    type: string;
    fullyQualifiedName?: string;
    description?: string;
    tags?: Array<{ name: string; tagFQN: string }>;
  };
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

const getEntityIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'table':
      return <TableOutlined />;
    case 'database':
      return <DatabaseOutlined />;
    case 'schema':
      return <FolderOutlined />;
    case 'dashboard':
      return <DashboardOutlined />;
    case 'pipeline':
      return <ForkOutlined />;
    case 'user':
      return <UserOutlined />;
    case 'team':
      return <TeamOutlined />;
    case 'tag':
      return <TagsOutlined />;
    case 'glossaryterm':
    case 'glossary':
      return <BookOutlined />;
    case 'domain':
      return <BankOutlined />;
    case 'dataproduct':
      return <AppstoreOutlined />;
    case 'topic':
      return <MailOutlined />;
    case 'container':
      return <ContainerOutlined />;
    case 'mlmodel':
      return <RobotOutlined />;
    case 'storedprocedure':
      return <SettingOutlined />;
    case 'searchindex':
      return <SearchOutlined />;
    default:
      return null;
  }
};

const KnowledgeGraphNodeDetails: React.FC<NodeDetailsProps> = ({
  node,
  onClose,
  onNavigate,
}) => {
  const { t } = useTranslation();

  return (
    <div className="knowledge-graph-node-details">
      <div className="node-details-header">
        <Space>
          {getEntityIcon(node.type)}
          <Title level={5} style={{ margin: 0 }}>
            {node.label}
          </Title>
        </Space>
        <Button
          icon={<CloseOutlined />}
          size="small"
          type="text"
          onClick={onClose}
        />
      </div>

      <div className="node-details-content">
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text type="secondary">{t('label.type')}</Text>
            <br />
            <Text>{node.type}</Text>
          </div>

          {node.fullyQualifiedName && (
            <div>
              <Text type="secondary">{t('label.fully-qualified-name')}</Text>
              <br />
              <Text copyable>{node.fullyQualifiedName}</Text>
            </div>
          )}

          {node.description && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text type="secondary">{t('label.description')}</Text>
                <Paragraph style={{ marginTop: 4 }}>
                  {node.description}
                </Paragraph>
              </div>
            </>
          )}

          {node.tags && node.tags.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div>
                <Text type="secondary">{t('label.tag-plural')}</Text>
                <div style={{ marginTop: 8 }}>
                  {node.tags.map((tag, index) => (
                    <Tag key={index} style={{ marginBottom: 4 }}>
                      {tag.name}
                    </Tag>
                  ))}
                </div>
              </div>
            </>
          )}

          <Divider style={{ margin: '12px 0' }} />

          <Button
            block
            icon={<LinkOutlined />}
            type="primary"
            onClick={() => onNavigate(node.id)}>
            {t('label.view-entity')}
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default KnowledgeGraphNodeDetails;
