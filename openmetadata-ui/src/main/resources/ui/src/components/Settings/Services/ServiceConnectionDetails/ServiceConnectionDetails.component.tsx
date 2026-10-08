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

import { Box, Card, Input } from '@openmetadata/ui-core-components';
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
import {
  getKeyValues,
  renderConnectionDetailLabel,
} from '../../../../utils/ServiceConnectionDetailsUtils';
import serviceUtilClassBase from '../../../../utils/ServiceUtilClassBase';

const DETAILS_CARD_CLASS = 'tw:grid tw:grid-cols-2 tw:gap-2 tw:p-4';

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
      <Card
        className={DETAILS_CARD_CLASS}
        data-testid="service-connection-details">
        {data}
      </Card>

      {extraInfo && (
        <Card className={`${DETAILS_CARD_CLASS} m-t-md m-y-lg`}>
          <Box align="center">
            {renderConnectionDetailLabel(
              extraInfo.headerKey,
              extraInfo.description
            )}
            <Input
              isReadOnly
              aria-label={extraInfo.headerKey}
              inputDataTestId="input-field"
              size="sm"
              type="text"
              value={extraInfo.displayName ?? extraInfo.name}
              wrapperClassName="tw:flex-1"
            />
          </Box>
        </Card>
      )}
    </>
  );
};

export default ServiceConnectionDetails;
