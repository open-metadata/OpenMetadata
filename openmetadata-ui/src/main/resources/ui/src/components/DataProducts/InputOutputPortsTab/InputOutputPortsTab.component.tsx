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
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  Button,
  Grid,
  Typography,
} from '@openmetadata/ui-core-components';
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
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE, SIZE } from '../../../enums/common.enum';
import { SearchIndex } from '../../../enums/search.enum';
import { DataProduct } from '../../../generated/entity/domains/dataProduct';
import { getDataProductPortsView } from '../../../rest/dataProductAPI';
import { getQueryFilterForDataProductPorts } from '../../../utils/DataProductPureUtils';
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

interface LineageAccordionSectionProps {
  isLineageExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  isLineageCollapsed: boolean;
  inputPortsCount: number;
  outputPortsCount: number;
  isLoadingLineage: boolean;
  assetCount: number;
  dataProduct: DataProduct;
  lineageInputPortsData: SearchedDataProps['data'];
  lineageOutputPortsData: SearchedDataProps['data'];
  isLineageFullScreen: boolean;
  onPortClick: (port: SearchedDataProps['data'][number]['_source']) => void;
  onToggleFullScreen: () => void;
}

const LineageAccordionSection = ({
  isLineageExpanded,
  onExpandedChange,
  isLineageCollapsed,
  inputPortsCount,
  outputPortsCount,
  isLoadingLineage,
  assetCount,
  dataProduct,
  lineageInputPortsData,
  lineageOutputPortsData,
  isLineageFullScreen,
  onPortClick,
  onToggleFullScreen,
}: LineageAccordionSectionProps) => {
  const { t } = useTranslation();

  return (
    <Grid className="tw:w-full tw:shrink-0 tw:p-1" gap="4">
      <Grid.Item span={24}>
        <Accordion
          allowsMultipleExpanded
          expandedKeys={isLineageExpanded ? new Set(['lineage']) : new Set()}
          onExpandedChange={(keys) => onExpandedChange(keys.has('lineage'))}>
          <AccordionItem id="lineage">
            <AccordionHeader data-testid="toggle-lineage-collapse">
              <div className="tw:flex tw:items-baseline tw:gap-1">
                <Typography as="span" className="tw:text-md">
                  {t('label.port-plural')} {t('label.lineage')}
                </Typography>
                {isLineageCollapsed && (
                  <Typography
                    as="p"
                    className="tw:text-xs tw:text-secondary tw:font-light">
                    ({inputPortsCount} {t('label.input').toLowerCase()},{' '}
                    {outputPortsCount} {t('label.output').toLowerCase()})
                  </Typography>
                )}
              </div>
            </AccordionHeader>
            <AccordionPanel>
              {isLoadingLineage ? (
                <div
                  className="tw:flex tw:justify-center tw:items-center"
                  style={{ height: 250 }}>
                  <Loader />
                </div>
              ) : (
                <ReactFlowProvider>
                  <PortsLineageView
                    assetCount={assetCount}
                    dataProduct={dataProduct}
                    height={250}
                    inputPortsData={lineageInputPortsData}
                    isFullScreen={isLineageFullScreen}
                    outputPortsData={lineageOutputPortsData}
                    onPortClick={onPortClick}
                    onToggleFullScreen={onToggleFullScreen}
                  />
                </ReactFlowProvider>
              )}
            </AccordionPanel>
          </AccordionItem>
        </Accordion>
      </Grid.Item>
    </Grid>
  );
};

interface InputPortsAccordionSectionProps {
  isInputPortsExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  inputPortsCount: number;
  permissions: OperationPermission;
  dataProductFqn: string;
  inputPortsListRef: React.RefObject<PortsListViewRef>;
  onAddInputPort: () => void;
  onRemovePort: () => void;
}

const InputPortsAccordionSection = ({
  isInputPortsExpanded,
  onExpandedChange,
  inputPortsCount,
  permissions,
  dataProductFqn,
  inputPortsListRef,
  onAddInputPort,
  onRemovePort,
}: InputPortsAccordionSectionProps) => {
  const { t } = useTranslation();
  const showHeaderAddButton =
    permissions.EditAll && isInputPortsExpanded && inputPortsCount > 0;

  return (
    <Grid.Item span={12}>
      <Accordion
        allowsMultipleExpanded
        expandedKeys={
          isInputPortsExpanded ? new Set(['input-ports']) : new Set()
        }
        onExpandedChange={(keys) => onExpandedChange(keys.has('input-ports'))}>
        <AccordionItem id="input-ports">
          <AccordionHeader data-testid="toggle-input-ports-collapse">
            <div className="tw:flex tw:items-center tw:justify-between tw:w-full tw:gap-2">
              <div className="tw:flex tw:items-baseline tw:gap-1">
                <Typography as="span" className="tw:text-md">
                  {t('label.entity-port-plural', {
                    entity: t('label.input'),
                  })}
                </Typography>
                <Typography
                  as="p"
                  className="tw:text-xs tw:text-secondary tw:font-light"
                  data-testid="input-port-count">
                  ({inputPortsCount})
                </Typography>
              </div>
              {showHeaderAddButton && (
                <Button
                  color="link-color"
                  data-testid="add-input-port-button"
                  iconLeading={<PlusOutlined />}
                  size="sm"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    onAddInputPort();
                  }}>
                  {`${t('label.add')} ${t('label.port')}`}
                </Button>
              )}
            </div>
          </AccordionHeader>
          <AccordionPanel>
            <div
              className="tw:flex tw:flex-col tw:pb-2"
              style={{ height: 'calc(100vh - 460px)' }}>
              {inputPortsCount === 0 ? (
                <ErrorPlaceHolder
                  className="m-t-0"
                  icon={
                    <AddPlaceHolderIcon
                      className="tw:w-16 tw:h-16"
                      data-testid="no-input-ports-placeholder"
                    />
                  }
                  size={SIZE.SMALL}
                  type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                  <Typography as="p" className="tw:text-center">
                    {t('message.no-input-ports-added')}
                  </Typography>
                  {permissions.EditAll && (
                    <Button
                      className="tw:mt-2"
                      color="primary"
                      data-testid="add-input-port-button"
                      iconLeading={<PlusOutlined />}
                      onClick={onAddInputPort}>
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
                  onRemovePort={onRemovePort}
                />
              )}
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Grid.Item>
  );
};

interface OutputPortsAccordionSectionProps {
  isOutputPortsExpanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  outputPortsCount: number;
  assetCount: number;
  permissions: OperationPermission;
  dataProductFqn: string;
  outputPortsListRef: React.RefObject<PortsListViewRef>;
  onAddOutputPort: () => void;
  onRemovePort: () => void;
}

const OutputPortsAccordionSection = ({
  isOutputPortsExpanded,
  onExpandedChange,
  outputPortsCount,
  assetCount,
  permissions,
  dataProductFqn,
  outputPortsListRef,
  onAddOutputPort,
  onRemovePort,
}: OutputPortsAccordionSectionProps) => {
  const { t } = useTranslation();
  const showHeaderAddButton =
    permissions.EditAll && isOutputPortsExpanded && outputPortsCount > 0;
  const emptyStateMessage =
    assetCount === 0
      ? t('message.no-assets-for-output-ports')
      : t('message.no-output-ports-added');
  const showEmptyStateAddButton = permissions.EditAll && assetCount > 0;

  return (
    <Grid.Item span={12}>
      <Accordion
        allowsMultipleExpanded
        expandedKeys={
          isOutputPortsExpanded ? new Set(['output-ports']) : new Set()
        }
        onExpandedChange={(keys) => onExpandedChange(keys.has('output-ports'))}>
        <AccordionItem id="output-ports">
          <AccordionHeader data-testid="toggle-output-ports-collapse">
            <div className="tw:flex tw:items-center tw:justify-between tw:w-full tw:gap-2">
              <div className="tw:flex tw:items-baseline tw:gap-1">
                <Typography as="span" className="tw:text-md">
                  {t('label.entity-port-plural', {
                    entity: t('label.output'),
                  })}
                </Typography>
                <Typography
                  as="p"
                  className="tw:text-xs tw:text-secondary tw:font-light"
                  data-testid="output-port-count">
                  ({outputPortsCount})
                </Typography>
              </div>
              {showHeaderAddButton && (
                <Button
                  color="link-color"
                  data-testid="add-output-port-button"
                  iconLeading={<PlusOutlined />}
                  size="sm"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    onAddOutputPort();
                  }}>
                  {`${t('label.add')} ${t('label.port')}`}
                </Button>
              )}
            </div>
          </AccordionHeader>
          <AccordionPanel>
            <div
              className="tw:flex tw:flex-col tw:pb-2"
              style={{ height: 'calc(100vh - 460px)' }}>
              {outputPortsCount === 0 ? (
                <ErrorPlaceHolder
                  className="m-t-0"
                  icon={
                    <AddPlaceHolderIcon
                      className="tw:w-16 tw:h-16"
                      data-testid="no-output-ports-placeholder"
                    />
                  }
                  size={SIZE.SMALL}
                  type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
                  <Typography as="p" className="tw:text-center">
                    {emptyStateMessage}
                  </Typography>
                  {showEmptyStateAddButton && (
                    <Button
                      className="tw:mt-2"
                      color="primary"
                      data-testid="add-output-port-button"
                      iconLeading={<PlusOutlined />}
                      onClick={onAddOutputPort}>
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
                  onRemovePort={onRemovePort}
                />
              )}
            </div>
          </AccordionPanel>
        </AccordionItem>
      </Accordion>
    </Grid.Item>
  );
};

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
    const [isAddingInputPort, setIsAddingInputPort] = useState(false);
    const [isAddingOutputPort, setIsAddingOutputPort] = useState(false);
    const [isLineageFullScreen, setIsLineageFullScreen] = useState(false);
    const [isLineageExpanded, setIsLineageExpanded] = useState(false);
    const [isInputPortsExpanded, setIsInputPortsExpanded] = useState(true);
    const [isOutputPortsExpanded, setIsOutputPortsExpanded] = useState(true);
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

    const isLineageCollapsed = !isLineageExpanded;

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
      <div
        className="tw:h-full tw:flex tw:flex-col tw:gap-5 tw:items-start tw:pb-3"
        data-testid="input-output-ports-tab">
        <LineageAccordionSection
          assetCount={assetCount}
          dataProduct={dataProduct}
          inputPortsCount={inputPortsCount}
          isLineageCollapsed={isLineageCollapsed}
          isLineageExpanded={isLineageExpanded}
          isLineageFullScreen={isLineageFullScreen}
          isLoadingLineage={isLoadingLineage}
          lineageInputPortsData={lineageInputPortsData}
          lineageOutputPortsData={lineageOutputPortsData}
          outputPortsCount={outputPortsCount}
          onExpandedChange={setIsLineageExpanded}
          onPortClick={handleLineagePortClick}
          onToggleFullScreen={handleToggleFullScreen}
        />

        <Grid className="tw:w-full tw:flex-1 tw:min-h-0 tw:p-1" gap="4">
          <InputPortsAccordionSection
            dataProductFqn={dataProductFqn}
            inputPortsCount={inputPortsCount}
            inputPortsListRef={inputPortsListRef}
            isInputPortsExpanded={isInputPortsExpanded}
            permissions={permissions}
            onAddInputPort={handleAddInputPort}
            onExpandedChange={setIsInputPortsExpanded}
            onRemovePort={refreshPorts}
          />

          <OutputPortsAccordionSection
            assetCount={assetCount}
            dataProductFqn={dataProductFqn}
            isOutputPortsExpanded={isOutputPortsExpanded}
            outputPortsCount={outputPortsCount}
            outputPortsListRef={outputPortsListRef}
            permissions={permissions}
            onAddOutputPort={handleAddOutputPort}
            onExpandedChange={setIsOutputPortsExpanded}
            onRemovePort={refreshPorts}
          />
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
      </div>
    );
  }
);

InputOutputPortsTab.displayName = 'InputOutputPortsTab';
