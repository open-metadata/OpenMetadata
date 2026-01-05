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

import { Button, List, Popconfirm, Space, Tooltip, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import { ReactComponent as DeleteIcon } from '../../../assets/svg/ic-delete.svg';
import { EntityReference } from '../../../generated/entity/type/entityReference';
import { getEntityIcon, getEntityName } from '../../../utils/EntityUtils';
import { EntityDetailsObjectInterface } from '../../Explore/ExplorePage.interface';
import { PortType } from './InputOutputPortsTab.interface';

interface PortListProps {
  ports: EntityReference[];
  type: PortType;
  canRemove: boolean;
  onRemovePort: (port: EntityReference) => void;
  onAddPort: () => void;
  onPortClick?: (port?: EntityDetailsObjectInterface) => void;
  isSummaryPanelOpen: boolean;
}

export const PortList = ({
  ports,
  type,
  canRemove,
  onRemovePort,
  onAddPort,
  onPortClick,
}: PortListProps) => {
  const { t } = useTranslation();

  const handlePortClick = (port: EntityReference) => {
    if (onPortClick) {
      // Convert EntityReference to EntityDetailsObjectInterface
      const portDetails: EntityDetailsObjectInterface = {
        details: port,
        entityType: port.type,
      };
      onPortClick(portDetails);
    }
  };

  if (ports.length === 0) {
    return (
      <div className="flex-center flex-col p-lg">
        <Typography.Paragraph className="text-grey-muted">
          {type === PortType.INPUT
            ? t('message.no-input-ports-added')
            : t('message.no-output-ports-added')}
        </Typography.Paragraph>
        {canRemove && (
          <Button
            data-testid={`add-${type.toLowerCase()}-port-button`}
            type="primary"
            onClick={onAddPort}>
            {t('label.add-entity', {
              entity:
                type === PortType.INPUT
                  ? t('label.input-port')
                  : t('label.output-port'),
            })}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div>
      {canRemove && (
        <div className="m-b-md text-right">
          <Button
            data-testid={`add-${type.toLowerCase()}-port-button`}
            type="primary"
            onClick={onAddPort}>
            {t('label.add-entity', {
              entity:
                type === PortType.INPUT
                  ? t('label.input-port')
                  : t('label.output-port'),
            })}
          </Button>
        </div>
      )}
      <List
        className="port-list"
        dataSource={ports}
        renderItem={(port) => (
          <List.Item
            actions={
              canRemove
                ? [
                    <Popconfirm
                      cancelText={t('label.cancel')}
                      key="delete"
                      okText={t('label.confirm')}
                      title={t('message.are-you-sure-delete-entity', {
                        entity: getEntityName(port),
                      })}
                      onConfirm={() => onRemovePort(port)}>
                      <Tooltip
                        title={t('label.remove-entity', {
                          entity:
                            type === PortType.INPUT
                              ? t('label.input-port')
                              : t('label.output-port'),
                        })}>
                        <Button
                          data-testid={`remove-port-${port.fullyQualifiedName}`}
                          icon={<DeleteIcon height={16} width={16} />}
                          size="small"
                          type="text"
                        />
                      </Tooltip>
                    </Popconfirm>,
                  ]
                : []
            }
            className="cursor-pointer hover-bg-grey"
            onClick={() => handlePortClick(port)}>
            <List.Item.Meta
              avatar={getEntityIcon(port.type)}
              description={
                <Typography.Text className="text-grey-muted">
                  {port.fullyQualifiedName}
                </Typography.Text>
              }
              title={
                <Typography.Text strong>{getEntityName(port)}</Typography.Text>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );
};
