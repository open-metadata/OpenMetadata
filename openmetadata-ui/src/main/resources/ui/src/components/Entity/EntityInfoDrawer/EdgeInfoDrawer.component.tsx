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

import { GitMerge, X } from '@openmetadata/ui-core-components/icons';
import {
  ButtonUtility,
  Tooltip,
  Typography,
} from '@openmetadata/ui-core-components';
import classNames from 'classnames';
import { TFunction } from 'i18next';
import { lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Edge, Node } from 'reactflow';
import DescriptionSection from '../../../components/common/DescriptionSection/DescriptionSection';
import OverviewSection from '../../../components/common/OverviewSection/OverviewSection';
import SectionWithEdit from '../../../components/common/SectionWithEdit/SectionWithEdit';
import { NO_DATA_PLACEHOLDER } from '../../../constants/constants';
import { LINEAGE_SOURCE } from '../../../constants/Lineage.constants';
import { CSMode } from '../../../enums/codemirror.enum';
import { EntityType } from '../../../enums/entity.enum';
import { AddLineage } from '../../../generated/api/lineage/addLineage';
import {
  EntityReference as LineagePipelineReference,
  LineageDetails,
  Source,
} from '../../../generated/type/entityLineage';
import { getRelativeTime } from '../../../utils/date-time/DateTimeUtils';
import { getLineageDetailsObject } from '../../../utils/EntityLineageEdgeUtils';
import { getColumnFunctionValue } from '../../../utils/EntityLineagePureUtils';
import { getEntityName } from '../../../utils/EntityNameUtils';
import entityUtilClassBase from '../../../utils/EntityUtilClassBase';
import { getNameFromFQN } from '../../../utils/FqnUtils';
import withSuspenseFallback from '../../AppRouter/withSuspenseFallback';
import Loader from '../../common/Loader/Loader';
import { EdgeInfoDrawerInfo } from './EntityInfoDrawer.interface';
const SchemaEditor = withSuspenseFallback(
  lazy(() => import('../../Database/SchemaEditor/SchemaEditor'))
);

const ModalWithFunctionEditor = withSuspenseFallback(
  lazy(() =>
    import('../../Modals/ModalWithFunctionEditor/ModalWithFunctionEditor').then(
      (m) => ({ default: m.ModalWithFunctionEditor })
    )
  )
);

const ModalWithQueryEditor = withSuspenseFallback(
  lazy(() =>
    import('../../Modals/ModalWithQueryEditor/ModalWithQueryEditor').then(
      (m) => ({ default: m.ModalWithQueryEditor })
    )
  )
);

const getUserTimeValue = (user?: string, timestamp?: number) => {
  const valueParts = [user, getRelativeTime(timestamp)].filter(Boolean);

  return valueParts.length > 0 ? valueParts.join(' ') : NO_DATA_PLACEHOLDER;
};

type OverviewDataItem = {
  name: string;
  value?: unknown;
  url?: string;
  isLink?: boolean;
  visible?: string[];
};

const getSourceOverviewItem = (
  sourceData: Node | undefined,
  t: TFunction
): OverviewDataItem | undefined => {
  if (!sourceData) {
    return undefined;
  }
  const {
    entityType: sourceEntityType = '',
    fullyQualifiedName: sourceFqn = '',
  } = sourceData?.data?.node ?? {};

  return {
    name: t('label.source'),
    value: getEntityName(sourceData?.data?.node),
    url: entityUtilClassBase.getEntityLink(sourceEntityType, sourceFqn),
    isLink: true,
  };
};

const getTargetOverviewItem = (
  targetData: Node | undefined,
  t: TFunction
): OverviewDataItem | undefined => {
  if (!targetData) {
    return undefined;
  }
  const {
    entityType: targetEntityType = '',
    fullyQualifiedName: targetFqn = '',
  } = targetData?.data?.node ?? {};

  return {
    name: t('label.target'),
    value: getEntityName(targetData?.data?.node),
    url: entityUtilClassBase.getEntityLink(targetEntityType, targetFqn),
    isLink: true,
  };
};

const getHandleOverviewItem = (
  handle: string | null | undefined,
  labelKey: string,
  t: TFunction
): OverviewDataItem | undefined =>
  handle ? { name: t(labelKey), value: getNameFromFQN(handle) } : undefined;

const getPipelineOverviewItem = (
  pipeline: LineagePipelineReference | undefined,
  pipelineEntityType: string | undefined,
  t: TFunction
): OverviewDataItem | undefined => {
  if (!pipeline) {
    return undefined;
  }

  return {
    name: t('label.edge'),
    value: getEntityName(pipeline),
    url: entityUtilClassBase.getEntityLink(
      pipelineEntityType as string,
      pipeline.fullyQualifiedName as string
    ),
    isLink: true,
  };
};

const getCreatedByOverviewItem = (
  edgeInfo: LineageDetails | undefined,
  t: TFunction
): OverviewDataItem | undefined =>
  edgeInfo?.createdBy || edgeInfo?.createdAt
    ? {
        name: t('label.created-by'),
        value: getUserTimeValue(edgeInfo?.createdBy, edgeInfo?.createdAt),
      }
    : undefined;

const getUpdatedByOverviewItem = (
  edgeInfo: LineageDetails | undefined,
  t: TFunction
): OverviewDataItem | undefined =>
  edgeInfo?.updatedBy || edgeInfo?.updatedAt
    ? {
        name: t('label.updated-by'),
        value: getUserTimeValue(edgeInfo?.updatedBy, edgeInfo?.updatedAt),
      }
    : undefined;

const buildEdgeOverviewData = (
  edge: Edge,
  sourceData: Node | undefined,
  targetData: Node | undefined,
  t: TFunction
): OverviewDataItem[] => {
  const { sourceHandle, targetHandle, data } = edge;
  const edgeInfo: LineageDetails | undefined = data?.edge;
  const { pipeline, pipelineEntityType } = edgeInfo ?? {};

  return [
    getSourceOverviewItem(sourceData, t),
    getHandleOverviewItem(sourceHandle, 'label.source-column', t),
    getTargetOverviewItem(targetData, t),
    getHandleOverviewItem(targetHandle, 'label.target-column', t),
    getPipelineOverviewItem(pipeline, pipelineEntityType, t),
    getCreatedByOverviewItem(edgeInfo, t),
    getUpdatedByOverviewItem(edgeInfo, t),
  ].filter((item): item is OverviewDataItem => Boolean(item));
};

const EdgeInfoDrawer = ({
  edge,
  visible,
  onClose,
  nodes,
  hasEditAccess,
  onEdgeDetailsUpdate,
}: EdgeInfoDrawerInfo) => {
  const [edgeData, setEdgeData] = useState<
    Array<{
      name: string;
      value?: unknown;
      url?: string;
      isLink?: boolean;
      visible?: string[];
    }>
  >([]);
  const [mysqlQuery, setMysqlQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSqlQueryModal, setShowSqlQueryModal] = useState(false);
  const [showSqlFunctionModal, setShowSqlFunctionModal] = useState(false);
  const [sqlFunction, setSqlFunction] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const { t } = useTranslation();

  const getModalContainer = useCallback(
    () => containerRef.current ?? document.body,
    []
  );

  const edgeEntity = useMemo(() => {
    return edge.data.edge;
  }, [edge]);

  const isColumnLineage = useMemo(() => {
    const { sourceHandle, targetHandle } = edge;

    return Boolean(sourceHandle && targetHandle);
  }, [edge]);

  const resolvedSqlQuery = useMemo(() => {
    const inlineQuery = edgeEntity?.sqlQuery;
    if (inlineQuery) {
      return inlineQuery;
    }

    // When the same SQL appears on multiple edges it is deduped into the target
    // node's lineageSqlQueries map and referenced from the edge by sqlQueryKey.
    const sqlQueryKey = edgeEntity?.sqlQueryKey;
    if (!sqlQueryKey) {
      return '';
    }

    const targetNode = nodes.find((node) => node.id === edge.target);

    return targetNode?.data?.node?.lineageSqlQueries?.[sqlQueryKey] ?? '';
  }, [edgeEntity, nodes, edge.target]);

  const onDescriptionUpdate = useCallback(
    async (updatedHTML: string) => {
      if (edgeEntity?.description !== updatedHTML && edge) {
        const lineageDetails = {
          ...getLineageDetailsObject(edge),
          description: updatedHTML,
        };

        const updatedEdgeDetails = {
          edge: {
            fromEntity: {
              id: edgeEntity.fromEntity.id,
              type: edgeEntity.fromEntity.type,
            },
            toEntity: {
              id: edgeEntity.toEntity.id,
              type: edgeEntity.toEntity.type,
            },
            lineageDetails,
          },
        } as AddLineage;
        await onEdgeDetailsUpdate?.(updatedEdgeDetails);
      }
    },
    [edgeEntity, edge]
  );

  const onFunctionUpdate = useCallback(
    async (updatedFunction: string) => {
      if (edge) {
        const { sourceHandle, targetHandle } = edge;
        const updatedColumnLineage = [...(edgeEntity.columns || [])];

        // Find and update the function for the specific column connection
        const columnIndex = updatedColumnLineage.findIndex(
          (col) =>
            col.fromColumns.includes(sourceHandle) &&
            col.toColumn === targetHandle
        );

        if (columnIndex >= 0) {
          updatedColumnLineage[columnIndex] = {
            ...updatedColumnLineage[columnIndex],
            function: updatedFunction,
          };
          const lineageDetails = {
            ...getLineageDetailsObject(edge),
            columnsLineage: updatedColumnLineage,
          };

          const updatedEdgeDetails = {
            edge: {
              fromEntity: {
                id: edgeEntity.fromEntity.id,
                type: edgeEntity.fromEntity.type,
              },
              toEntity: {
                id: edgeEntity.toEntity.id,
                type: edgeEntity.toEntity.type,
              },
              lineageDetails,
            },
          } as AddLineage;

          await onEdgeDetailsUpdate?.(updatedEdgeDetails);
          setSqlFunction(updatedFunction);
          setShowSqlFunctionModal(false);
        }
      }
    },
    [edgeEntity, edge]
  );

  const edgeDetailsSection = useMemo(() => {
    const { data } = edge;
    const { sourceHandle, targetHandle } = edge;

    if (isColumnLineage) {
      const functionValue = getColumnFunctionValue(
        data?.edge?.columns ?? [],
        sourceHandle ?? '',
        targetHandle ?? ''
      );

      return (
        <SectionWithEdit
          className="sql-function-section tw:mt-4 tw:last:border-b-0"
          showEditButton={hasEditAccess}
          title={t('label.sql-function')}
          titleClassName="tw:justify-start tw:gap-2"
          onEdit={() => {
            setSqlFunction(functionValue ?? '');
            setShowSqlFunctionModal(true);
          }}>
          <Typography className="tw:m-0" data-testid="sql-function">
            {functionValue ?? NO_DATA_PLACEHOLDER}
          </Typography>
        </SectionWithEdit>
      );
    }

    return (
      <>
        <SectionWithEdit
          className="tw:mt-4 tw:last:border-b-0"
          showEditButton={hasEditAccess}
          title={t('label.sql-uppercase-query')}
          titleClassName="tw:justify-start tw:gap-2"
          onEdit={() => setShowSqlQueryModal(true)}>
          {mysqlQuery ? (
            <SchemaEditor
              className="tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:dark:border-subtle tw:[&_.cm-editor]:h-50 tw:[&_.cm-editor]:rounded-lg"
              mode={{ name: CSMode.SQL }}
              options={{
                styleActiveLine: false,
                readOnly: 'nocursor',
              }}
              value={mysqlQuery}
            />
          ) : (
            <Typography as="p" className="tw:m-0">
              {t('server.no-query-available')}
            </Typography>
          )}
        </SectionWithEdit>
        <SectionWithEdit
          className="tw:mt-4 tw:last:border-b-0"
          showEditButton={false}
          title={t('label.lineage-source')}>
          <Typography className="tw:text-xs tw:font-normal tw:text-utility-gray-900">
            {LINEAGE_SOURCE[edgeEntity.source as keyof typeof Source]}
          </Typography>
        </SectionWithEdit>
      </>
    );
  }, [
    isColumnLineage,
    edgeEntity?.description,
    hasEditAccess,
    edgeEntity.source,
    mysqlQuery,
    onDescriptionUpdate,
    edge,
    sqlFunction,
  ]);

  const getEdgeInfo = () => {
    const { source, target } = edge;

    let sourceData: Node | undefined, targetData: Node | undefined;
    nodes.forEach((node) => {
      if (source === node.id) {
        sourceData = node;
      } else if (target === node.id) {
        targetData = node;
      }
    });

    setEdgeData(buildEdgeOverviewData(edge, sourceData, targetData, t));
    setIsLoading(false);
  };

  const onSqlQueryUpdate = useCallback(
    async (updatedQuery: string) => {
      if (mysqlQuery !== updatedQuery && edge) {
        const lineageDetails = {
          ...getLineageDetailsObject(edge),
          sqlQuery: updatedQuery,
        };

        const updatedEdgeDetails = {
          edge: {
            fromEntity: {
              id: edgeEntity.fromEntity.id,
              type: edgeEntity.fromEntity.type,
            },
            toEntity: {
              id: edgeEntity.toEntity.id,
              type: edgeEntity.toEntity.type,
            },
            lineageDetails,
          },
        } as AddLineage;
        await onEdgeDetailsUpdate?.(updatedEdgeDetails);
        setMysqlQuery(updatedQuery);
      }
      setShowSqlQueryModal(false);
    },
    [edgeEntity, edge, mysqlQuery]
  );

  useEffect(() => {
    setIsLoading(true);
    getEdgeInfo();
    setMysqlQuery(resolvedSqlQuery);
  }, [edge, visible, nodes, resolvedSqlQuery]);

  return (
    <>
      {visible && (
        <div
          className="tw:flex tw:h-full tw:flex-col tw:bg-utility-gray-blue-50"
          data-testid="edge-info-drawer-container"
          ref={containerRef}>
          <div className="tw:flex tw:items-center tw:justify-between">
            <div className="tw:sticky tw:top-0 tw:z-999 tw:flex-1 tw:p-1">
              <div className="tw:flex tw:h-[49px] tw:items-center tw:justify-between tw:rounded-lg tw:bg-utility-gray-blue-50 tw:px-3 tw:dark:bg-secondary_subtle">
                <Tooltip
                  excludeTriggerFromTabOrder
                  delay={500}
                  placement="bottom left"
                  title={t('label.edge-information')}
                  triggerClassName="tw:flex tw:items-center tw:gap-2">
                  <span className="tw:flex tw:items-center tw:gap-2">
                    <span className="tw:flex">
                      <GitMerge height={16} width={16} />
                    </span>
                    <Typography
                      className="tw:block tw:text-[15px] tw:leading-[1.5715] tw:font-semibold tw:text-utility-gray-800"
                      data-testid="edge-header-title">
                      {t('label.edge-information')}
                    </Typography>
                  </span>
                </Tooltip>
              </div>
            </div>
            <ButtonUtility
              aria-label={t('label.close')}
              className="tw:mr-2 tw:size-9 tw:rounded-lg tw:p-0 tw:text-primary tw:hover:bg-transparent tw:hover:text-primary"
              color="tertiary"
              data-testid="drawer-close-icon"
              icon={X}
              size="xs"
              onPress={onClose}
            />
          </div>
          <div
            className={classNames(
              'tw:mx-3 tw:max-h-[calc(100vh-70px)] tw:flex-1 tw:overflow-x-hidden tw:overflow-y-auto',
              'tw:rounded-lg tw:border tw:border-utility-gray-blue-100 tw:bg-primary tw:dark:border-subtle',
              'tw:[scrollbar-width:none] tw:[&::-webkit-scrollbar]:hidden'
            )}>
            {isLoading ? (
              <Loader />
            ) : (
              <div className="d-flex flex-col">
                <div className="tw:mt-4 tw:last:border-b-0 tw:[&_.description-section]:mt-0">
                  <DescriptionSection
                    description={edgeEntity?.description ?? ''}
                    entityFqn={edgeEntity.fromEntity.fullyQualifiedName}
                    entityType={EntityType.LINEAGE_EDGE}
                    hasPermission={hasEditAccess}
                    showEditButton={hasEditAccess}
                    onDescriptionUpdate={onDescriptionUpdate}
                  />
                </div>
                {edgeData && edgeData.length > 0 && (
                  <div className="tw:mt-4 tw:last:border-b-0">
                    <OverviewSection
                      componentType=""
                      entityInfoV1={edgeData}
                      showEditButton={false}
                    />
                  </div>
                )}

                {edgeDetailsSection}
              </div>
            )}
          </div>
        </div>
      )}
      {showSqlQueryModal && (
        <ModalWithQueryEditor
          getContainer={getModalContainer}
          header={t('label.edit-entity', {
            entity: t('label.sql-uppercase-query'),
          })}
          value={mysqlQuery ?? ''}
          visible={showSqlQueryModal}
          onCancel={() => setShowSqlQueryModal(false)}
          onSave={onSqlQueryUpdate}
        />
      )}
      {showSqlFunctionModal && (
        <ModalWithFunctionEditor
          getContainer={getModalContainer}
          header={t('label.edit-entity', {
            entity: t('label.sql-function'),
          })}
          value={sqlFunction}
          visible={showSqlFunctionModal}
          onCancel={() => setShowSqlFunctionModal(false)}
          onSave={onFunctionUpdate}
        />
      )}
    </>
  );
};

export default EdgeInfoDrawer;
