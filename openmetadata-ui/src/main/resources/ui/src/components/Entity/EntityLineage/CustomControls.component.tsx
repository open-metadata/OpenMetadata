/*
 *  Copyright 2022 Collate.
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

import { SettingOutlined } from '@ant-design/icons';
import { Button, Col, Row, Select, Space } from 'antd';
import Input from 'antd/lib/input/Input';
import { ReactComponent as EditIconColor } from 'assets/svg/ic-edit-lineage-colored.svg';
import { ReactComponent as EditIcon } from 'assets/svg/ic-edit-lineage.svg';
import classNames from 'classnames';
import { PRIMERY_COLOR } from 'constants/constants';
import { NO_PERMISSION_FOR_ACTION } from 'constants/HelperTextUtil';
import {
  MAX_ZOOM_VALUE,
  MIN_ZOOM_VALUE,
  ZOOM_BUTTON_STEP,
  ZOOM_SLIDER_STEP,
  ZOOM_TRANSITION_DURATION,
} from 'constants/Lineage.constants';
import { isEqual, sortBy, uniqWith } from 'lodash';
import { EntityTags } from 'Models';
import React, {
  FC,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useReactFlow } from 'reactflow';
import { getLoadingStatusValue } from 'utils/EntityLineageUtils';
import { getEntityName } from 'utils/EntityUtils';
import SVGIcons, { Icons } from 'utils/SvgUtils';
import { EntityType } from '../../../enums/entity.enum';
import { TagSource } from '../../../generated/type/tagLabel';
import LineageTagsContainer from '../../LineageTag/LineageTagsContainer/LineageTagsContainer';
import { DisplayType } from '../../Tag/TagsViewer/TagsViewer.interface';
import { fetchEntityDetails } from './EntityLineage.component';
import {
  ControlProps,
  LineageConfig,
  SelectedNode,
} from './EntityLineage.interface';
import LineageConfigModal from './LineageConfigModal';
import { ReactComponent as ExitFullScreen } from '/assets/svg/exit-full-screen.svg';
import { ReactComponent as FullScreen } from '/assets/svg/full-screen.svg';

const CustomControls: FC<ControlProps> = ({
  style,
  isColumnsExpanded,
  showFitView = true,
  showZoom = true,
  fitViewParams,
  className,
  deleted,
  isEditMode,
  hasEditAccess,
  onEditLinageClick,
  onExpandColumnClick,
  handleFullScreenViewClick,
  onExitFullScreenViewClick,
  loading,
  status,
  zoomValue,
  lineageData,
  lineageConfig,
  onOptionSelect,
  onLineageConfigUpdate,
  onSelectedTagsUpdate,
}: ControlProps) => {
  const { t } = useTranslation();
  const { fitView, zoomTo } = useReactFlow();
  const [zoom, setZoom] = useState<number>(zoomValue);
  const [dialogVisible, setDialogVisible] = useState<boolean>(false);
  const [selectedTags, setSelectedTags] = useState<EntityTags[]>();

  const onZoomHandler = useCallback(
    (zoomLevel: number) => {
      zoomTo?.(zoomLevel, { duration: ZOOM_TRANSITION_DURATION });
    },
    [zoomTo]
  );

  const onZoomInHandler = useCallback(() => {
    setZoom((pre) => {
      const zoomInValue = pre < MAX_ZOOM_VALUE ? pre + ZOOM_BUTTON_STEP : pre;
      onZoomHandler(zoomInValue);

      return zoomInValue;
    });
  }, [onZoomHandler]);

  const onZoomOutHandler = useCallback(() => {
    setZoom((pre) => {
      const zoomOutValue = pre > MIN_ZOOM_VALUE ? pre - ZOOM_BUTTON_STEP : pre;
      onZoomHandler(zoomOutValue);

      return zoomOutValue;
    });
  }, [onZoomHandler]);

  const onFitViewHandler = useCallback(() => {
    fitView?.(fitViewParams);
  }, [fitView, fitViewParams]);

  const handleSearchFilterOption = (
    input: string,
    option?: {
      label: string;
      value: string;
    }
  ) => {
    return (option?.label || '').toLowerCase().includes(input.toLowerCase());
  };

  const onRangeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const zoomValue = parseFloat(event.target.value);
    onZoomHandler(zoomValue);
    setZoom(zoomValue);
  };

  useEffect(() => {
    if (zoomValue !== zoom) {
      setZoom(zoomValue);
    }
  }, [zoomValue]);

  const nodeOptions = useMemo(
    () =>
      [lineageData.entity, ...(lineageData.nodes || [])].map((node) => ({
        label: getEntityName(node),
        value: node.id,
      })),
    [lineageData]
  );

  // ------------------

  type EntityDetails = {
    [key: string]: any;
  };

  const getNodesTags = async (nodes: SelectedNode[]) => {
    const nodesTags: EntityTags[] = [];

    for (const node of nodes) {
      const entity = (await fetchEntityDetails(node)) as EntityDetails;
      for (const tag of entity.tags) {
        nodesTags.push({
          tagFQN: tag.tagFQN,
          description: tag.description,
          source: 'Classification',
          labelType: 'Manual',
          state: 'Confirmed',
        } as EntityTags);
      }
    }

    const uniqueTags = uniqWith(nodesTags, (a, b) => isEqual(a, b));
    const sortedUniqueTags = sortBy(uniqueTags, ['tagFQN']);
    setSelectedTags(sortedUniqueTags);
  };

  useEffect(() => {
    const currentNodes: SelectedNode[] = [];
    if (lineageData.nodes !== undefined) {
      for (const node of lineageData.nodes) {
        currentNodes.push({
          name: node.name || '',
          type: node.type,
          fqn: node.fullyQualifiedName || '',
          entityId: node.id,
        });
      }
    }
    getNodesTags(currentNodes);
  }, [lineageData]);

  const handleTagSelection = async (tags: EntityTags[]) => {
    const sortedUniqueTags = sortBy(tags, ['tagFQN']);
    setSelectedTags(sortedUniqueTags);
    onSelectedTagsUpdate(sortedUniqueTags as EntityTags[]);
  };

  // ----------

  const editIcon = useMemo(() => {
    return (
      <span className="anticon">
        {isEditMode ? (
          <EditIcon height="16px" width="16px" />
        ) : (
          <EditIconColor height="16px" width="16px" />
        )}
      </span>
    );
  }, [isEditMode]);

  const handleDialogSave = useCallback(
    (config: LineageConfig) => {
      onLineageConfigUpdate(config);
      setDialogVisible(false);
    },
    [onLineageConfigUpdate, setDialogVisible]
  );

  return (
    <>
      <Row
        className={classNames('z-10 w-full', className)}
        gutter={[8, 8]}
        style={style}>
        <Col span={8}>
          <Select
            allowClear
            showSearch
            className={classNames('custom-control-search-box', {
              'custom-control-search-box-edit-mode': isEditMode,
            })}
            data-testid="lineage-search"
            filterOption={handleSearchFilterOption}
            options={nodeOptions}
            placeholder={t('label.search-entity', {
              entity: t('label.lineage'),
            })}
            onChange={onOptionSelect}
          />
        </Col>
        <Col span={8}>
          <Space className="justify-end w-full" size={12}>
            <Button
              ghost
              className="expand-btn"
              data-testid="expand-column"
              type="primary"
              onClick={onExpandColumnClick}>
              {isColumnsExpanded
                ? t('label.collapse-all')
                : t('label.expand-all')}
            </Button>

            {showZoom && (
              <div className="flow-control custom-control-fit-screen-button custom-control-zoom-slide items-center">
                <Button
                  className={classNames('control-button', 'p-y-0')}
                  data-testid="zoom-in-button"
                  icon={
                    <SVGIcons
                      alt="minus-icon"
                      icon="icon-control-minus"
                      width="12"
                    />
                  }
                  type="text"
                  onClick={onZoomOutHandler}
                />

                <Input
                  className="border-none bg-transparent p-0"
                  data-testid="lineage-zoom-slider"
                  max={MAX_ZOOM_VALUE}
                  min={MIN_ZOOM_VALUE}
                  step={ZOOM_SLIDER_STEP}
                  type="range"
                  value={zoom}
                  onChange={onRangeChange}
                />

                <Button
                  className={classNames('control-button', 'p-y-0')}
                  data-testid="zoom-out-button"
                  icon={
                    <SVGIcons
                      alt="plus-icon"
                      icon="icon-control-plus"
                      width="12"
                    />
                  }
                  type="text"
                  onClick={onZoomInHandler}
                />
              </div>
            )}
            {showFitView && (
              <Button
                className=" custom-control-fit-screen-button"
                data-testid="fit-to-screen"
                icon={
                  <span className="anticon">
                    <SVGIcons alt="fit-view" icon={Icons.FITVEW} width="16" />
                  </span>
                }
                title={t('label.fit-to-screen')}
                onClick={onFitViewHandler}
              />
            )}
            {handleFullScreenViewClick && (
              <Button
                className="custom-control-fit-screen-button"
                data-testid="full-screen"
                icon={
                  <span className="anticon">
                    <FullScreen color={PRIMERY_COLOR} height={16} width={16} />
                  </span>
                }
                title={t('label.full-screen')}
                onClick={handleFullScreenViewClick}
              />
            )}
            {onExitFullScreenViewClick && (
              <Button
                className=" custom-control-fit-screen-button"
                data-testid="exit-full-screen"
                icon={
                  <span className="anticon">
                    <ExitFullScreen
                      color={PRIMERY_COLOR}
                      height={16}
                      width={16}
                    />
                  </span>
                }
                title={t('label.exit-fit-to-screen')}
                onClick={onExitFullScreenViewClick}
              />
            )}

            <Button
              className=" custom-control-fit-screen-button"
              data-testid="lineage-config"
              disabled={isEditMode}
              icon={
                <SettingOutlined
                  style={{ fontSize: '16px', color: PRIMERY_COLOR }}
                />
              }
              title={t('label.setting-plural')}
              onClick={() => setDialogVisible(true)}
            />

            {!deleted && (
              <Button
                className={classNames(
                  'custom-control-edit-button rounded-full',
                  {
                    active: isEditMode,
                  }
                )}
                data-testid="edit-lineage"
                disabled={!hasEditAccess}
                icon={getLoadingStatusValue(editIcon, loading, status)}
                title={
                  hasEditAccess
                    ? t('label.edit-entity', { entity: t('label.lineage') })
                    : NO_PERMISSION_FOR_ACTION
                }
                onClick={onEditLinageClick}
              />
            )}
          </Space>
        </Col>

        <Col span={6}>
          <Space className="justify-center w-full" size={6}>
            <LineageTagsContainer
              permission
              displayType={DisplayType.POPOVER}
              entityFqn=""
              entityType={EntityType.CLASSIFICATION}
              selectedTags={selectedTags as EntityTags[]}
              tagType={TagSource.Classification}
              onSelectionChange={handleTagSelection}
            />
          </Space>
        </Col>
      </Row>
      <LineageConfigModal
        config={lineageConfig}
        visible={dialogVisible}
        onCancel={() => setDialogVisible(false)}
        onSave={handleDialogSave}
      />
    </>
  );
};

export default memo(CustomControls);
