/*
 *  Copyright 2023 Collate.
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

import { Button } from 'antd';
import classNames from 'classnames';
import { isUndefined, startCase } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { PIPELINE_TYPE_LOCALIZATION } from '../../constants/Ingestions.constant';
import { MetadataServiceType } from '../../generated/api/services/createMetadataService';
import { Connection } from '../../generated/entity/services/databaseService';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { Connection as MetadataConnection } from '../../generated/entity/services/metadataService';
import { getAddIngestionPath } from '../../utils/RouterUtils';
import { dropdownIcon as DropdownIcon } from '../../utils/svgconstant';
import DropDownList from '../dropdown/DropDownList';
import { AddIngestionButtonProps } from './ingestion.interface';

function AddIngestionButton({
  serviceDetails,
  pipelineType,
  serviceCategory,
  serviceName,
  ingestionData,
  ingestionList,
  permissions,
}: AddIngestionButtonProps) {
  const { t } = useTranslation();
  const history = useHistory();
  const [showActions, setShowActions] = useState(false);

  const isOpenMetadataService = useMemo(
    () =>
      serviceDetails?.connection?.config?.type ===
      MetadataServiceType.OpenMetadata,
    [serviceDetails]
  );

  const supportedPipelineTypes = useMemo((): PipelineType[] => {
    let pipelineType = [];
    const config = serviceDetails?.connection?.config as Connection;
    if (config) {
      config.supportsMetadataExtraction &&
        pipelineType.push(PipelineType.Metadata);
      config.supportsUsageExtraction && pipelineType.push(PipelineType.Usage);
      config.supportsUsageExtraction && pipelineType.push(PipelineType.Lineage);
      config.supportsProfiler && pipelineType.push(PipelineType.Profiler);
      config.supportsDBTExtraction && pipelineType.push(PipelineType.Dbt);
      (config as MetadataConnection).supportsDataInsightExtraction &&
        pipelineType.push(PipelineType.DataInsight);
      (config as MetadataConnection)
        .supportsElasticSearchReindexingExtraction &&
        pipelineType.push(PipelineType.ElasticSearchReindex);
    } else {
      pipelineType = [
        PipelineType.Metadata,
        PipelineType.Usage,
        PipelineType.Lineage,
        PipelineType.Profiler,
        PipelineType.Dbt,
      ];
    }

    return pipelineType;
  }, [serviceDetails]);

  const handleAddIngestionClick = (type?: PipelineType) => {
    setShowActions(false);
    if (type) {
      history.push(getAddIngestionPath(serviceCategory, serviceName, type));
    }
  };

  const isDataSightIngestionExists = useMemo(
    () =>
      ingestionData.some(
        (ingestion) => ingestion.pipelineType === PipelineType.DataInsight
      ),
    [ingestionData]
  );

  const types = useMemo((): PipelineType[] => {
    const pipelineTypeArray = isUndefined(pipelineType)
      ? supportedPipelineTypes
      : [pipelineType];

    if (isOpenMetadataService || ingestionList.length > 0) {
      return pipelineTypeArray.reduce((prev, curr) => {
        if (
          // Prevent adding multiple usage pipeline
          curr === PipelineType.Usage &&
          ingestionList.find((d) => d.pipelineType === curr)
        ) {
          return prev;
        } else {
          return [...prev, curr];
        }
      }, [] as PipelineType[]);
    }

    return [
      PipelineType.Metadata,
      PipelineType.Usage,
      PipelineType.Lineage,
      PipelineType.Profiler,
      PipelineType.Dbt,
    ];
  }, [pipelineType, serviceDetails]);

  // Check if service has atleast one metadata pipeline available or not
  const hasMetadata = useMemo(
    () =>
      ingestionList.find(
        (ingestion) => ingestion.pipelineType === PipelineType.Metadata
      ),
    [ingestionList]
  );

  return types.length ? (
    hasMetadata ? (
      // if service has metadata then show all available option
      <>
        <Button
          className={classNames('h-8 rounded-4 m-b-xs d-flex items-center')}
          data-testid="add-new-ingestion-button"
          disabled={!permissions.Create}
          size="small"
          type="primary"
          onClick={() => setShowActions((pre) => !pre)}>
          {t('label.add-entity', { entity: t('label.ingestion-lowercase') })}
          {showActions ? (
            <DropdownIcon
              style={{
                transform: 'rotate(180deg)',
                verticalAlign: 'middle',
                color: '#fff',
              }}
            />
          ) : (
            <DropdownIcon
              style={{
                color: '#fff',
                verticalAlign: 'middle',
              }}
            />
          )}
        </Button>
        {showActions && (
          <DropDownList
            horzPosRight
            dropDownList={types.map((type) => ({
              name: t('label.add-workflow-ingestion', {
                workflow: t(`label.${PIPELINE_TYPE_LOCALIZATION[type]}`),
              }),
              disabled:
                type === PipelineType.DataInsight
                  ? isDataSightIngestionExists
                  : false,
              value: type,
            }))}
            onSelect={(_e, value) =>
              handleAddIngestionClick(value as PipelineType)
            }
          />
        )}
      </>
    ) : (
      /**
       * If service does not have any metadata pipeline then
       * show only option for metadata ingestion
       */
      <Button
        className={classNames('h-8 rounded-4 m-b-xs')}
        data-testid="add-new-ingestion-button"
        size="small"
        type="primary"
        onClick={() =>
          handleAddIngestionClick(
            pipelineType ? pipelineType : PipelineType.Metadata
          )
        }>
        {t('label.add-workflow-ingestion', {
          workflow: startCase(
            pipelineType ? pipelineType : PipelineType.Metadata
          ),
        })}
      </Button>
    )
  ) : null;
}

export default AddIngestionButton;
