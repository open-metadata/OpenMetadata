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

import { Button, Card, Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { forwardRef, useCallback, useImperativeHandle, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/ic-no-records.svg';
import { EntityReference } from '../../../generated/entity/type/entityReference';
import { QueryFilterInterface } from '../../../pages/ExplorePage/ExplorePage.interface';
import {
  addInputPortsToDataProduct,
  addOutputPortsToDataProduct,
  removeInputPortsFromDataProduct,
  removeOutputPortsFromDataProduct,
} from '../../../rest/dataProductAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import { AssetSelectionDrawer } from '../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import AssetsTabs, {
  AssetsTabRef,
} from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import {
  InputOutputPortsTabProps,
  InputOutputPortsTabRef,
  PortType,
} from './InputOutputPortsTab.interface';

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
      queryFilter,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const [isAddingInputPort, setIsAddingInputPort] = useState(false);
    const [isAddingOutputPort, setIsAddingOutputPort] = useState(false);
    const inputPortsTabRef = React.useRef<AssetsTabRef>(null);
    const outputPortsTabRef = React.useRef<AssetsTabRef>(null);

    const refreshPorts = useCallback(() => {
      onPortsUpdate();
      inputPortsTabRef.current?.refreshAssets();
      outputPortsTabRef.current?.refreshAssets();
    }, [onPortsUpdate]);

    useImperativeHandle(ref, () => ({
      refreshPorts,
    }));

    const handleAddInputPort = useCallback(() => {
      setIsAddingInputPort(true);
    }, []);

    const handleAddOutputPort = useCallback(() => {
      setIsAddingOutputPort(true);
    }, []);

    const handleInputPortSave = useCallback(async () => {
      setIsAddingInputPort(false);
      refreshPorts();
    }, [refreshPorts]);

    const handleOutputPortSave = useCallback(async () => {
      setIsAddingOutputPort(false);
      refreshPorts();
    }, [refreshPorts]);

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

    // Empty state when no ports at all
    if (hasNoPorts) {
      return (
        <>
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

          <AssetSelectionDrawer
            entityFqn={dataProductFqn}
            open={isAddingInputPort}
            queryFilter={queryFilter}
            type={AssetsOfEntity.DATA_PRODUCT}
            onCancel={() => setIsAddingInputPort(false)}
            onSave={handleInputPortSave}
          />

          <AssetSelectionDrawer
            entityFqn={dataProductFqn}
            open={isAddingOutputPort}
            queryFilter={queryFilter}
            type={AssetsOfEntity.DATA_PRODUCT}
            onCancel={() => setIsAddingOutputPort(false)}
            onSave={handleOutputPortSave}
          />
        </>
      );
    }

    // Display cards when we have ports
    return (
      <div className="input-output-ports-tab p-md" data-testid="input-output-ports-tab">
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Card
              className="h-full"
              extra={
                permissions.EditAll && (
                  <Button
                    data-testid="add-input-port-button"
                    type="primary"
                    onClick={handleAddInputPort}>
                    {t('label.add')}
                  </Button>
                )
              }
              title={
                <Typography.Text strong>
                  {t('label.input-port-plural')}
                </Typography.Text>
              }>
              {inputPorts.length === 0 ? (
                <ErrorPlaceHolder
                  className="m-t-0"
                  icon={
                    <AddPlaceHolderIcon
                      className="w-16 h-16"
                      data-testid="no-input-ports-placeholder"
                    />
                  }
                  size="small"
                  type="ADD_DATA">
                  <Typography.Paragraph className="text-center">
                    {t('message.no-input-ports-added')}
                  </Typography.Paragraph>
                </ErrorPlaceHolder>
              ) : (
                <AssetsTabs
                  assetCount={inputPorts.length}
                  entityFqn={dataProductFqn}
                  isSummaryPanelOpen={isSummaryPanelOpen}
                  permissions={permissions}
                  ref={inputPortsTabRef}
                  type={AssetsOfEntity.DATA_PRODUCT}
                  onAddAsset={handleAddInputPort}
                  onAssetClick={onPortClick}
                  onRemoveAsset={refreshPorts}
                />
              )}
            </Card>
          </Col>

          <Col span={12}>
            <Card
              className="h-full"
              extra={
                permissions.EditAll && (
                  <Button
                    data-testid="add-output-port-button"
                    type="primary"
                    onClick={handleAddOutputPort}>
                    {t('label.add')}
                  </Button>
                )
              }
              title={
                <Typography.Text strong>
                  {t('label.output-port-plural')}
                </Typography.Text>
              }>
              {outputPorts.length === 0 ? (
                <ErrorPlaceHolder
                  className="m-t-0"
                  icon={
                    <AddPlaceHolderIcon
                      className="w-16 h-16"
                      data-testid="no-output-ports-placeholder"
                    />
                  }
                  size="small"
                  type="ADD_DATA">
                  <Typography.Paragraph className="text-center">
                    {t('message.no-output-ports-added')}
                  </Typography.Paragraph>
                </ErrorPlaceHolder>
              ) : (
                <AssetsTabs
                  assetCount={outputPorts.length}
                  entityFqn={dataProductFqn}
                  isSummaryPanelOpen={isSummaryPanelOpen}
                  permissions={permissions}
                  ref={outputPortsTabRef}
                  type={AssetsOfEntity.DATA_PRODUCT}
                  onAddAsset={handleAddOutputPort}
                  onAssetClick={onPortClick}
                  onRemoveAsset={refreshPorts}
                />
              )}
            </Card>
          </Col>
        </Row>

        <AssetSelectionDrawer
          entityFqn={dataProductFqn}
          open={isAddingInputPort}
          queryFilter={queryFilter}
          type={AssetsOfEntity.DATA_PRODUCT}
          onCancel={() => setIsAddingInputPort(false)}
          onSave={handleInputPortSave}
        />

        <AssetSelectionDrawer
          entityFqn={dataProductFqn}
          open={isAddingOutputPort}
          queryFilter={queryFilter}
          type={AssetsOfEntity.DATA_PRODUCT}
          onCancel={() => setIsAddingOutputPort(false)}
          onSave={handleOutputPortSave}
        />
      </div>
    );
  }
);

InputOutputPortsTab.displayName = 'InputOutputPortsTab';
