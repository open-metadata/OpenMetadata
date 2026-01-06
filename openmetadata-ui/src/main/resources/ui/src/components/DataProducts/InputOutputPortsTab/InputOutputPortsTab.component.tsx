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

import {
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Typography,
  useTheme,
} from '@mui/material';
import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/ic-no-records.svg';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import {
  getInputPortsQueryFilter,
  getOutputPortsQueryFilter,
} from '../../../utils/DataProduct/InputOutputPortsUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import { AssetSelectionDrawer } from '../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer';
import AssetsTabs, {
  AssetsTabRef,
} from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.component';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import {
  InputOutputPortsTabProps,
  InputOutputPortsTabRef,
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
    const theme = useTheme();
    const [isAddingInputPort, setIsAddingInputPort] = useState(false);
    const [isAddingOutputPort, setIsAddingOutputPort] = useState(false);
    const inputPortsTabRef = React.useRef<AssetsTabRef>(null);
    const outputPortsTabRef = React.useRef<AssetsTabRef>(null);

    // Create query filters for input/output ports based on their FQNs
    const inputPortsQueryFilter = useMemo(
      () => getInputPortsQueryFilter(inputPorts),
      [inputPorts]
    );

    const outputPortsQueryFilter = useMemo(
      () => getOutputPortsQueryFilter(outputPorts),
      [outputPorts]
    );

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

    return (
      <Box
        className="input-output-ports-tab"
        data-testid="input-output-ports-tab"
        sx={{ p: 2 }}>
        <Grid container spacing={2}>
          <Grid size={12}>
            <Card
              sx={{
                border: `1px solid ${theme.palette.grey[300]}`,
                borderRadius: '8px',
                height: 'auto',
              }}
              variant="outlined">
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  backgroundColor: theme.palette.grey[50],
                  borderRadius: '8px 8px 0 0',
                  fontSize: '14px',
                  fontWeight: 500,
                }}>
                <Typography fontWeight={500} variant="body1">
                  {t('label.entity-port-plural', { entity: t('label.input') })}
                </Typography>
                {permissions.EditAll && (
                  <Button
                    data-testid="add-input-port-button"
                    size="small"
                    variant="contained"
                    onClick={handleAddInputPort}>
                    {t('label.add')}
                  </Button>
                )}
              </Box>
              <CardContent
                sx={{
                  height: 'auto',
                  maxHeight: 'none',
                  transition: 'all 200ms ease',
                  transitionProperty: 'height, left, top',
                }}>
                {inputPorts.length === 0 ? (
                  <ErrorPlaceHolder
                    className="m-t-0"
                    icon={
                      <AddPlaceHolderIcon
                        className="w-16 h-16"
                        data-testid="no-input-ports-placeholder"
                      />
                    }
                    size={SIZE.SMALL}
                    type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                    <Typography className="text-center">
                      {t('message.no-input-ports-added')}
                    </Typography>
                  </ErrorPlaceHolder>
                ) : (
                  <AssetsTabs
                    assetCount={inputPorts.length}
                    entityFqn={dataProductFqn}
                    isSummaryPanelOpen={isSummaryPanelOpen}
                    permissions={permissions}
                    queryFilter={inputPortsQueryFilter}
                    ref={inputPortsTabRef}
                    type={AssetsOfEntity.DATA_PRODUCT_INPUT_PORT}
                    onAddAsset={handleAddInputPort}
                    onAssetClick={onPortClick}
                    onRemoveAsset={refreshPorts}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>

          <Grid size={12}>
            <Card
              sx={{
                border: `1px solid ${theme.palette.grey[300]}`,
                borderRadius: '8px',
                height: 'auto',
              }}
              variant="outlined">
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  p: 2,
                  backgroundColor: theme.palette.grey[50],
                  borderRadius: '8px 8px 0 0',
                  fontSize: '14px',
                  fontWeight: 500,
                }}>
                <Typography fontWeight={500} variant="body1">
                  {t('label.entity-port-plural', { entity: t('label.output') })}
                </Typography>
                {permissions.EditAll && (
                  <Button
                    data-testid="add-output-port-button"
                    size="small"
                    variant="contained"
                    onClick={handleAddOutputPort}>
                    {t('label.add')}
                  </Button>
                )}
              </Box>
              <CardContent
                sx={{
                  height: 'auto',
                  maxHeight: 'none',
                  transition: 'all 200ms ease',
                  transitionProperty: 'height, left, top',
                }}>
                {outputPorts.length === 0 ? (
                  <ErrorPlaceHolder
                    className="m-t-0"
                    icon={
                      <AddPlaceHolderIcon
                        className="w-16 h-16"
                        data-testid="no-output-ports-placeholder"
                      />
                    }
                    size={SIZE.SMALL}
                    type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                    <Typography className="text-center">
                      {t('message.no-output-ports-added')}
                    </Typography>
                  </ErrorPlaceHolder>
                ) : (
                  <AssetsTabs
                    assetCount={outputPorts.length}
                    entityFqn={dataProductFqn}
                    isSummaryPanelOpen={isSummaryPanelOpen}
                    permissions={permissions}
                    queryFilter={outputPortsQueryFilter}
                    ref={outputPortsTabRef}
                    type={AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT}
                    onAddAsset={handleAddOutputPort}
                    onAssetClick={onPortClick}
                    onRemoveAsset={refreshPorts}
                  />
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        <AssetSelectionDrawer
          entityFqn={dataProductFqn}
          open={isAddingInputPort}
          queryFilter={queryFilter}
          type={AssetsOfEntity.DATA_PRODUCT_INPUT_PORT}
          onCancel={() => setIsAddingInputPort(false)}
          onSave={handleInputPortSave}
        />

        <AssetSelectionDrawer
          entityFqn={dataProductFqn}
          open={isAddingOutputPort}
          queryFilter={queryFilter}
          type={AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT}
          onCancel={() => setIsAddingOutputPort(false)}
          onSave={handleOutputPortSave}
        />
      </Box>
    );
  }
);

InputOutputPortsTab.displayName = 'InputOutputPortsTab';
