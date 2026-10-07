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

import { Box, Input, Tooltip } from '@openmetadata/ui-core-components';
import { InfoCircle } from '@openmetadata/ui-core-components/icons';
import { isEmpty } from 'lodash';
import { ReactNode, useEffect, useState } from 'react';
import { EntityType } from '../../../../enums/entity.enum';
import { APIServiceType } from '../../../../generated/entity/services/apiService';
import { DashboardServiceType } from '../../../../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../../../../generated/entity/services/databaseService';
import { DriveServiceType } from '../../../../generated/entity/services/driveService';
import { MessagingServiceType } from '../../../../generated/entity/services/messagingService';
import { MetadataServiceType } from '../../../../generated/entity/services/metadataService';
import { MlModelServiceType } from '../../../../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../../../../generated/entity/services/pipelineService';
import { SearchServiceType } from '../../../../generated/entity/services/searchService';
import { Type as SecurityServiceType } from '../../../../generated/entity/services/securityService';
import { StorageServiceType } from '../../../../generated/entity/services/storageService';
import {
  ConfigData,
  ExtraInfoType,
} from '../../../../interface/service.interface';
import { getOwnHandler } from '../../../../utils/RecordUtils';
import { getKeyValues } from '../../../../utils/ServiceConnectionDetailsUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';

// Preserve the existing light card geometry while dark mode uses a raised surface.
const DETAILS_CARD_CLASS =
  'tw:block tw:rounded-lg tw:border tw:border-[var(--om-grey-15,#eaecf5)] tw:bg-primary tw:p-4 tw:dark:border-secondary tw:dark:bg-surface';

type ServiceConnectionDetailsProps = {
  connectionDetails: ConfigData;
  serviceCategory: string;
  serviceFQN: string;
  extraInfo?: ExtraInfoType | null;
};

const SERVICE_CONFIG_LOADER_BY_CATEGORY: Partial<
  Record<
    EntityType,
    (serviceFQN: string) => Promise<{ schema: Record<string, unknown> }>
  >
> = {
  [EntityType.DATABASE_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getDatabaseServiceConfig(
      serviceFQN as DatabaseServiceType
    ),
  [EntityType.DASHBOARD_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getDashboardServiceConfig(
      serviceFQN as DashboardServiceType
    ),
  [EntityType.MESSAGING_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getMessagingServiceConfig(
      serviceFQN as MessagingServiceType
    ),
  [EntityType.PIPELINE_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getPipelineServiceConfig(
      serviceFQN as PipelineServiceType
    ),
  [EntityType.MLMODEL_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getMlModelServiceConfig(
      serviceFQN as MlModelServiceType
    ),
  [EntityType.METADATA_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getMetadataServiceConfig(
      serviceFQN as MetadataServiceType
    ),
  [EntityType.STORAGE_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getStorageServiceConfig(
      serviceFQN as StorageServiceType
    ),
  [EntityType.SEARCH_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getSearchServiceConfig(
      serviceFQN as SearchServiceType
    ),
  [EntityType.API_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getAPIServiceConfig(serviceFQN as APIServiceType),
  [EntityType.SECURITY_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getSecurityServiceConfig(
      serviceFQN as SecurityServiceType
    ),
  [EntityType.DRIVE_SERVICE]: (serviceFQN) =>
    serviceUtilClassBase.getDriveServiceConfig(serviceFQN as DriveServiceType),
};

const loadSchemaForServiceCategory = (
  serviceCategory: string,
  serviceFQN: string
): Promise<{ schema: Record<string, unknown> }> => {
  const loader = getOwnHandler(
    SERVICE_CONFIG_LOADER_BY_CATEGORY,
    serviceCategory.slice(0, -1)
  );

  return loader ? loader(serviceFQN) : Promise.resolve({ schema: {} });
};

const ServiceConnectionDetails = ({
  connectionDetails,
  serviceCategory,
  serviceFQN,
  extraInfo,
}: Readonly<ServiceConnectionDetailsProps>) => {
  const [schema, setSchema] = useState<Record<string, unknown>>({});
  const [data, setData] = useState<ReactNode>();

  useEffect(() => {
    let cancelled = false;
    loadSchemaForServiceCategory(serviceCategory, serviceFQN)
      .then((result) => {
        if (!cancelled) {
          setSchema(result.schema);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSchema({});
        }
      });

    return () => {
      cancelled = true;
    };
  }, [serviceCategory, serviceFQN]);

  useEffect(() => {
    if (!isEmpty(schema)) {
      setData(
        getKeyValues({
          obj: connectionDetails as unknown as Record<string, unknown>,
          schemaPropertyObject: schema.properties as Record<string, unknown>,
          schema,
          serviceCategory,
        })
      );
    }
  }, [schema]);

  return (
    <>
      <Box
        className={DETAILS_CARD_CLASS}
        data-testid="service-connection-details">
        <Box className="tw:-mx-1 tw:-my-1 tw:w-full tw:flex-wrap">{data}</Box>
      </Box>

      {extraInfo && (
        <Box className={`${DETAILS_CARD_CLASS} m-t-md m-y-lg`}>
          <Box className="tw:-mx-1 tw:-my-1 tw:w-full tw:flex-wrap">
            <Box className="tw:w-1/2 tw:px-1 tw:py-1">
              <Box className="tw:w-full">
                <Box align="center" className="tw:w-1/3">
                  <Box align="center">
                    <p className="text-grey-muted tw:dark:text-tertiary m-0">
                      {extraInfo.headerKey}
                    </p>
                    {extraInfo.description && (
                      <Tooltip placement="bottom" title={extraInfo.description}>
                        <InfoCircle className="tw:mx-1 tw:size-3.5 tw:text-[#C4C4C4] tw:dark:text-fg-quaternary" />
                      </Tooltip>
                    )}
                  </Box>
                </Box>
                <Box className="tw:w-2/3">
                  <Input
                    isReadOnly
                    aria-label={extraInfo.headerKey}
                    inputClassName="tw:h-8 tw:px-[11px] tw:py-1 tw:text-sm tw:leading-[22px]"
                    inputDataTestId="input-field"
                    type="text"
                    value={extraInfo.displayName ?? extraInfo.name}
                    wrapperClassName="tw:rounded-lg tw:bg-transparent tw:shadow-none tw:outline-0!"
                  />
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>
      )}
    </>
  );
};

export default ServiceConnectionDetails;
