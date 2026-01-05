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

import { Button, Collapse, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/ic-no-records.svg';
import { ReactComponent as PortIcon } from '../../../assets/svg/ic-schema.svg';
import { EntityType } from '../../../enums/entity.enum';
import { EntityReference } from '../../../generated/entity/type/entityReference';
import {
  addInputPortsToDataProduct,
  addOutputPortsToDataProduct,
  removeInputPortsFromDataProduct,
  removeOutputPortsFromDataProduct,
} from '../../../rest/dataProductAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { PortList } from './PortList.component';
import {
  InputOutputPortsTabProps,
  InputOutputPortsTabRef,
  PortType,
} from './InputOutputPortsTab.interface';

const { Panel } = Collapse;

export const InputOutputPortsTab = forwardRef<
  InputOutputPortsTabRef,
  InputOutputPortsTabProps
>(
  (
    {
      dataProductFqn,
      inputPorts = [],
      outputPorts = [],
      permissions,
      onPortsUpdate,
      onPortClick,
      isSummaryPanelOpen,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [isAddingInputPort, setIsAddingInputPort] = useState(false);
    const [isAddingOutputPort, setIsAddingOutputPort] = useState(false);

    const refreshPorts = useCallback(() => {
      onPortsUpdate();
    }, [onPortsUpdate]);

    useImperativeHandle(ref, () => ({
      refreshPorts,
    }));

    const handleAddInputPort = useCallback(() => {
      setIsAddingInputPort(true);
      // TODO: Open asset selection modal for input ports
      // This will be similar to the AssetSelectionDrawer used in DataProductsDetailsPage
    }, []);

    const handleAddOutputPort = useCallback(() => {
      setIsAddingOutputPort(true);
      // TODO: Open asset selection modal for output ports
    }, []);

    const handleRemoveInputPort = useCallback(
      async (port: EntityReference) => {
        try {
          await removeInputPortsFromDataProduct(dataProductFqn, [port]);
          showSuccessToast(
            t('message.entity-removed-successfully', {
              entity: getEntityName(port),
            })
          );
          refreshPorts();
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      },
      [dataProductFqn, refreshPorts, t]
    );

    const handleRemoveOutputPort = useCallback(
      async (port: EntityReference) => {
        try {
          await removeOutputPortsFromDataProduct(dataProductFqn, [port]);
          showSuccessToast(
            t('message.entity-removed-successfully', {
              entity: getEntityName(port),
            })
          );
          refreshPorts();
        } catch (error) {
          showErrorToast(error as AxiosError);
        }
      },
      [dataProductFqn, refreshPorts, t]
    );

    const hasNoPorts = inputPorts.length === 0 && outputPorts.length === 0;

    if (hasNoPorts) {
      return (
        <ErrorPlaceHolder
          className="m-t-lg"
          icon={
            <AddPlaceHolderIcon
              className="w-24 h-24"
              data-testid="no-ports-placeholder"
            />
          }
          type="ADD_DATA">
          <Typography.Paragraph className="text-center">
            {t('message.no-input-output-ports-configured')}
          </Typography.Paragraph>
          <Typography.Paragraph className="text-center text-grey-muted">
            {t('message.input-output-ports-description')}
          </Typography.Paragraph>
          {permissions.EditAll && (
            <Space className="m-t-md">
              <Button
                data-testid="add-input-port-button"
                type="primary"
                onClick={handleAddInputPort}>
                {t('label.add-entity', { entity: t('label.input-port') })}
              </Button>
              <Button
                data-testid="add-output-port-button"
                type="primary"
                onClick={handleAddOutputPort}>
                {t('label.add-entity', { entity: t('label.output-port') })}
              </Button>
            </Space>
          )}
        </ErrorPlaceHolder>
      );
    }

    return (
      <div className="input-output-ports-tab" data-testid="input-output-ports-tab">
        <Collapse
          bordered={false}
          className="bg-white"
          defaultActiveKey={['input', 'output']}>
          <Panel
            header={
              <Space>
                <PortIcon height={16} width={16} />
                <Typography.Text strong>
                  {t('label.input-port-plural')} ({inputPorts.length})
                </Typography.Text>
              </Space>
            }
            key="input">
            <PortList
              canRemove={permissions.EditAll}
              isSummaryPanelOpen={isSummaryPanelOpen}
              ports={inputPorts}
              type={PortType.INPUT}
              onAddPort={handleAddInputPort}
              onPortClick={onPortClick}
              onRemovePort={handleRemoveInputPort}
            />
          </Panel>

          <Panel
            header={
              <Space>
                <PortIcon height={16} width={16} />
                <Typography.Text strong>
                  {t('label.output-port-plural')} ({outputPorts.length})
                </Typography.Text>
              </Space>
            }
            key="output">
            <PortList
              canRemove={permissions.EditAll}
              isSummaryPanelOpen={isSummaryPanelOpen}
              ports={outputPorts}
              type={PortType.OUTPUT}
              onAddPort={handleAddOutputPort}
              onPortClick={onPortClick}
              onRemovePort={handleRemoveOutputPort}
            />
          </Panel>
        </Collapse>
      </div>
    );
  }
);

InputOutputPortsTab.displayName = 'InputOutputPortsTab';
