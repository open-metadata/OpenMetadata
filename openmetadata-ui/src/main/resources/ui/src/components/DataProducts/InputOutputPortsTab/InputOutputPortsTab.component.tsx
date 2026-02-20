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

import { PlusOutlined } from '@ant-design/icons';
import {
  Box,
  Card,
  CardContent,
  Collapse,
  Grid,
  IconButton,
  Typography,
  useTheme,
} from '@mui/material';
import { ChevronDown, ChevronUp } from '@untitledui/icons';
import { Button } from 'antd';
import { AxiosError } from 'axios';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { ReactFlowProvider } from 'reactflow';
import { ReactComponent as AddPlaceHolderIcon } from '../../../assets/svg/ic-no-records.svg';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { getDataProductPortsView } from '../../../rest/dataProductAPI';
import { getQueryFilterForDataProductPorts } from '../../../utils/DataProductUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../common/Loader/Loader';
import { AssetSelectionDrawer } from '../../DataAssets/AssetsSelectionModal/AssetSelectionDrawer';
import { AssetsOfEntity } from '../../Glossary/GlossaryTerms/tabs/AssetsTabs.interface';
import { SearchedDataProps } from '../../SearchedData/SearchedData.interface';
import {
  InputOutputPortsTabProps,
  InputOutputPortsTabRef,
} from './InputOutputPortsTab.types';
import { PortsLineageView } from './PortsLineageView';
import { PortsListView, PortsListViewRef } from './PortsListView';

export const InputOutputPortsTab = forwardRef<
  InputOutputPortsTabRef,
  InputOutputPortsTabProps
>(
  (
    {
      dataProduct,
      dataProductFqn,
      permissions,
      assetCount,
      onPortsUpdate,
      onPortClick,
    },
    ref
  ) => {
    const { t } = useTranslation();
    const theme = useTheme();
    const [isAddingInputPort, setIsAddingInputPort] = useState(false);
    const [isAddingOutputPort, setIsAddingOutputPort] = useState(false);
    const [isLineageFullScreen, setIsLineageFullScreen] = useState(false);
    const [isLineageCollapsed, setIsLineageCollapsed] = useState(true);
    const [isInputPortsCollapsed, setIsInputPortsCollapsed] = useState(false);
    const [isOutputPortsCollapsed, setIsOutputPortsCollapsed] = useState(false);
    const inputPortsListRef = React.useRef<PortsListViewRef>(null);
    const outputPortsListRef = React.useRef<PortsListViewRef>(null);

    // Lineage data - lazy loaded when expanded
    const [lineageInputPortsData, setLineageInputPortsData] = useState<
      SearchedDataProps['data']
    >([]);
    const [lineageOutputPortsData, setLineageOutputPortsData] = useState<
      SearchedDataProps['data']
    >([]);
    const [isLoadingLineage, setIsLoadingLineage] = useState(false);
    const [lineageLoaded, setLineageLoaded] = useState(false);

    // Port counts - fetched from portsView API
    const [inputPortsCount, setInputPortsCount] = useState(0);
    const [outputPortsCount, setOutputPortsCount] = useState(0);

    // Compute query filter for port selection drawer
    // Only show assets that belong to the DataProduct
    const portQueryFilter = useMemo(() => {
      return getQueryFilterForDataProductPorts(dataProductFqn);
    }, [dataProductFqn]);

    // Fetch lineage data and counts (only when lineage section is expanded, or on initial load for counts)
    const fetchLineageData = useCallback(async () => {
      if (lineageLoaded || !dataProductFqn) {
        return;
      }

      setIsLoadingLineage(true);
      try {
        const data = await getDataProductPortsView(dataProductFqn);

        const inputPortsSearchData = data.inputPorts.data.map((entity) => ({
          _id: entity.id,
          _index: SearchIndex.DATA_ASSET,
          _source: entity,
        })) as unknown as SearchedDataProps['data'];

        const outputPortsSearchData = data.outputPorts.data.map((entity) => ({
          _id: entity.id,
          _index: SearchIndex.DATA_ASSET,
          _source: entity,
        })) as unknown as SearchedDataProps['data'];

        setLineageInputPortsData(inputPortsSearchData);
        setLineageOutputPortsData(outputPortsSearchData);
        setInputPortsCount(data.inputPorts.paging.total);
        setOutputPortsCount(data.outputPorts.paging.total);
        setLineageLoaded(true);
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsLoadingLineage(false);
      }
    }, [dataProductFqn, lineageLoaded]);

    // Fetch counts on initial load
    const fetchPortCounts = useCallback(async () => {
      if (!dataProductFqn) {
        return;
      }

      try {
        const data = await getDataProductPortsView(dataProductFqn);
        setInputPortsCount(data.inputPorts.paging.total);
        setOutputPortsCount(data.outputPorts.paging.total);
      } catch (error) {
        showErrorToast(error as AxiosError);
      }
    }, [dataProductFqn]);

    const refreshPorts = useCallback(() => {
      // Reset lineage data so it will be refetched when expanded
      setLineageLoaded(false);
      setLineageInputPortsData([]);
      setLineageOutputPortsData([]);

      // Refresh the PortsListView components
      inputPortsListRef.current?.refreshPorts();
      outputPortsListRef.current?.refreshPorts();

      // Refresh counts
      fetchPortCounts();

      // Notify parent
      onPortsUpdate();
    }, [onPortsUpdate, fetchPortCounts]);

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

    const handleToggleFullScreen = useCallback(() => {
      setIsLineageFullScreen((prev) => !prev);
    }, []);

    const handleLineagePortClick = useCallback(
      (port: SearchedDataProps['data'][number]['_source']) => {
        if (onPortClick) {
          onPortClick({ details: port });
        }
      },
      [onPortClick]
    );

    const handleToggleLineageCollapse = useCallback(() => {
      setIsLineageCollapsed((prev) => !prev);
    }, []);

    // Fetch port counts on initial load
    useEffect(() => {
      fetchPortCounts();
    }, [fetchPortCounts]);

    // Lazy load lineage data when section is expanded
    useEffect(() => {
      if (!isLineageCollapsed && !lineageLoaded) {
        fetchLineageData();
      }
    }, [isLineageCollapsed, lineageLoaded, fetchLineageData]);

    useEffect(() => {
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape' && isLineageFullScreen) {
          setIsLineageFullScreen(false);
        }
      };

      if (isLineageFullScreen) {
        document.addEventListener('keydown', handleKeyDown);
      }

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    }, [isLineageFullScreen]);

    return (
      <Box
        className="input-output-ports-tab"
        data-testid="input-output-ports-tab"
        sx={{
          height: '100%',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 5,
        }}>
        <Grid container spacing={2} sx={{ width: '100%', flexShrink: 0 }}>
          <Grid size={12}>
            <Card
              sx={{
                border: `1px solid ${theme.palette.allShades.blueGray[100]}`,
                borderRadius: '8px',
                overflow: 'visible',
                boxShadow: 'none',
              }}
              variant="outlined">
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  backgroundColor: theme.palette.grey[50],
                  borderRadius: isLineageCollapsed ? '8px' : '8px 8px 0 0',
                  cursor: 'pointer',
                }}
                onClick={handleToggleLineageCollapse}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography fontWeight={500} variant="body1">
                    {t('label.port-plural')} {t('label.lineage')}
                  </Typography>
                  {isLineageCollapsed && (
                    <Typography color="text.secondary" variant="caption">
                      ({inputPortsCount} {t('label.input').toLowerCase()},{' '}
                      {outputPortsCount} {t('label.output').toLowerCase()})
                    </Typography>
                  )}
                </Box>
                <IconButton
                  data-testid="toggle-lineage-collapse"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleLineageCollapse();
                  }}>
                  {isLineageCollapsed ? (
                    <ChevronDown height={20} width={20} />
                  ) : (
                    <ChevronUp height={20} width={20} />
                  )}
                </IconButton>
              </Box>
              <Collapse in={!isLineageCollapsed}>
                <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
                  {isLoadingLineage ? (
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        height: 250,
                      }}>
                      <Loader />
                    </Box>
                  ) : (
                    <ReactFlowProvider>
                      <PortsLineageView
                        assetCount={assetCount}
                        dataProduct={dataProduct}
                        height={250}
                        inputPortsData={lineageInputPortsData}
                        isFullScreen={isLineageFullScreen}
                        outputPortsData={lineageOutputPortsData}
                        onPortClick={handleLineagePortClick}
                        onToggleFullScreen={handleToggleFullScreen}
                      />
                    </ReactFlowProvider>
                  )}
                </CardContent>
              </Collapse>
            </Card>
          </Grid>
        </Grid>

        <Grid
          container
          spacing={2}
          sx={{ width: '100%', flex: 1, minHeight: 0 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                border: `1px solid ${theme.palette.allShades.blueGray[100]}`,
                borderRadius: '8px',
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
              }}
              variant="outlined">
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  backgroundColor: theme.palette.grey[50],
                  borderRadius: isInputPortsCollapsed ? '8px' : '8px 8px 0 0',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onClick={() => setIsInputPortsCollapsed((prev) => !prev)}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography fontWeight={500} variant="body1">
                    {t('label.entity-port-plural', {
                      entity: t('label.input'),
                    })}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    ({inputPortsCount})
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {permissions.EditAll &&
                    !isInputPortsCollapsed &&
                    inputPortsCount > 0 && (
                      <Button
                        className="h-8 flex items-center"
                        data-testid="add-input-port-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddInputPort();
                        }}>
                        {t('label.add')}
                      </Button>
                    )}
                  <IconButton
                    data-testid="toggle-input-ports-collapse"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsInputPortsCollapsed((prev) => !prev);
                    }}>
                    {isInputPortsCollapsed ? (
                      <ChevronDown height={20} width={20} />
                    ) : (
                      <ChevronUp height={20} width={20} />
                    )}
                  </IconButton>
                </Box>
              </Box>
              <Collapse in={!isInputPortsCollapsed}>
                <CardContent
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    '&:last-child': { pb: 2 },
                    height: isInputPortsCollapsed
                      ? 'auto'
                      : 'calc(100vh - 400px)',
                  }}>
                  {inputPortsCount === 0 ? (
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
                      {permissions.EditAll && (
                        <Button
                          className="m-t-md"
                          data-testid="add-input-port-button"
                          icon={<PlusOutlined />}
                          type="primary"
                          onClick={handleAddInputPort}>
                          {t('label.add-entity', {
                            entity: t('label.entity-port-plural', {
                              entity: t('label.input'),
                            }),
                          })}
                        </Button>
                      )}
                    </ErrorPlaceHolder>
                  ) : (
                    <PortsListView
                      dataProductFqn={dataProductFqn}
                      permissions={permissions}
                      portType="input"
                      ref={inputPortsListRef}
                      onRemovePort={refreshPorts}
                    />
                  )}
                </CardContent>
              </Collapse>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <Card
              sx={{
                border: `1px solid ${theme.palette.allShades.blueGray[100]}`,
                borderRadius: '8px',
                boxShadow: 'none',
                display: 'flex',
                flexDirection: 'column',
              }}
              variant="outlined">
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 16px',
                  backgroundColor: theme.palette.grey[50],
                  borderRadius: isOutputPortsCollapsed ? '8px' : '8px 8px 0 0',
                  fontSize: '14px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                onClick={() => setIsOutputPortsCollapsed((prev) => !prev)}>
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1 }}>
                  <Typography fontWeight={500} variant="body1">
                    {t('label.entity-port-plural', {
                      entity: t('label.output'),
                    })}
                  </Typography>
                  <Typography color="text.secondary" variant="caption">
                    ({outputPortsCount})
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  {permissions.EditAll &&
                    !isOutputPortsCollapsed &&
                    outputPortsCount > 0 && (
                      <Button
                        className="h-8 flex items-center"
                        data-testid="add-output-port-button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddOutputPort();
                        }}>
                        {t('label.add')}
                      </Button>
                    )}
                  <IconButton
                    data-testid="toggle-output-ports-collapse"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOutputPortsCollapsed((prev) => !prev);
                    }}>
                    {isOutputPortsCollapsed ? (
                      <ChevronDown height={20} width={20} />
                    ) : (
                      <ChevronUp height={20} width={20} />
                    )}
                  </IconButton>
                </Box>
              </Box>
              <Collapse in={!isOutputPortsCollapsed}>
                <CardContent
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    '&:last-child': { pb: 2 },
                    height: isOutputPortsCollapsed
                      ? 'auto'
                      : 'calc(100vh - 400px)',
                  }}>
                  {outputPortsCount === 0 ? (
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
                        {assetCount === 0
                          ? t('message.no-assets-for-output-ports')
                          : t('message.no-output-ports-added')}
                      </Typography>
                      {permissions.EditAll && assetCount > 0 && (
                        <Button
                          className="m-t-md"
                          data-testid="add-output-port-button"
                          icon={<PlusOutlined />}
                          type="primary"
                          onClick={handleAddOutputPort}>
                          {t('label.add-entity', {
                            entity: t('label.entity-port-plural', {
                              entity: t('label.output'),
                            }),
                          })}
                        </Button>
                      )}
                    </ErrorPlaceHolder>
                  ) : (
                    <PortsListView
                      dataProductFqn={dataProductFqn}
                      permissions={permissions}
                      portType="output"
                      ref={outputPortsListRef}
                      onRemovePort={refreshPorts}
                    />
                  )}
                </CardContent>
              </Collapse>
            </Card>
          </Grid>
        </Grid>

        <AssetSelectionDrawer
          entityFqn={dataProductFqn}
          open={isAddingInputPort}
          title={t('label.add-entity', {
            entity: t('label.entity-port-plural', { entity: t('label.input') }),
          })}
          type={AssetsOfEntity.DATA_PRODUCT_INPUT_PORT}
          onCancel={() => setIsAddingInputPort(false)}
          onSave={handleInputPortSave}
        />

        <AssetSelectionDrawer
          entityFqn={dataProductFqn}
          infoBannerText={t('message.output-ports-from-data-product-assets')}
          open={isAddingOutputPort}
          queryFilter={portQueryFilter}
          title={t('label.add-entity', {
            entity: t('label.entity-port-plural', {
              entity: t('label.output'),
            }),
          })}
          type={AssetsOfEntity.DATA_PRODUCT_OUTPUT_PORT}
          onCancel={() => setIsAddingOutputPort(false)}
          onSave={handleOutputPortSave}
        />
      </Box>
    );
  }
);

InputOutputPortsTab.displayName = 'InputOutputPortsTab';
