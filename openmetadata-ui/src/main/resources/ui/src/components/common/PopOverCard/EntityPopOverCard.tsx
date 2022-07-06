/*
 *  Copyright 2021 Collate
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

import { Popover } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import { uniqueId } from 'lodash';
import { EntityTags } from 'Models';
import React, { FC, HTMLAttributes, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AppState from '../../../AppState';
import { getDashboardByFqn } from '../../../axiosAPIs/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../../../axiosAPIs/databaseAPI';
import { getMlModelByFQN } from '../../../axiosAPIs/mlModelAPI';
import { getPipelineByFqn } from '../../../axiosAPIs/pipelineAPI';
import { getTableDetailsByFQN } from '../../../axiosAPIs/tableAPI';
import { getTopicByFqn } from '../../../axiosAPIs/topicsAPI';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { getEntityName } from '../../../utils/CommonUtils';
import {
  getEntityLink,
  getTagsWithoutTier,
  getTierTags,
} from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

export type EntityData = Table &
  Topic &
  Dashboard &
  Pipeline &
  Mlmodel &
  Database &
  DatabaseSchema;

interface Props extends HTMLAttributes<HTMLDivElement> {
  entityType: string;
  entityFQN: string;
}

const EntityPopOverCard: FC<Props> = ({ children, entityType, entityFQN }) => {
  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);

  const entityTier = useMemo(() => {
    const tierFQN = getTierTags(entityData.tags || [])?.tagFQN;

    return tierFQN?.split(FQN_SEPARATOR_CHAR)[1];
  }, [entityData.tags]);

  const entityTags = useMemo(() => {
    const tags: EntityTags[] = getTagsWithoutTier(entityData.tags || []) || [];

    return tags.map((tag) => `#${tag.tagFQN}`);
  }, [entityData.tags]);

  const getData = () => {
    const setEntityDetails = (entityDetail: EntityData) => {
      AppState.entityData[entityFQN] = entityDetail;
    };

    const fields = 'tags,owner';

    switch (entityType) {
      case EntityType.TABLE:
        getTableDetailsByFQN(entityFQN, fields)
          .then((res: AxiosResponse) => {
            setEntityDetails(res.data);

            setEntityData(res.data);
          })
          .catch((err: AxiosError) => showErrorToast(err));

        break;
      case EntityType.TOPIC:
        getTopicByFqn(entityFQN, fields)
          .then((res: AxiosResponse) => {
            setEntityDetails(res.data);

            setEntityData(res.data);
          })
          .catch((err: AxiosError) => showErrorToast(err));

        break;
      case EntityType.DASHBOARD:
        getDashboardByFqn(entityFQN, fields)
          .then((res: AxiosResponse) => {
            setEntityDetails(res.data);

            setEntityData(res.data);
          })
          .catch((err: AxiosError) => showErrorToast(err));

        break;
      case EntityType.PIPELINE:
        getPipelineByFqn(entityFQN, fields)
          .then((res: AxiosResponse) => {
            setEntityDetails(res.data);

            setEntityData(res.data);
          })
          .catch((err: AxiosError) => showErrorToast(err));

        break;
      case EntityType.MLMODEL:
        getMlModelByFQN(entityFQN, fields)
          .then((res: AxiosResponse) => {
            setEntityDetails(res.data);

            setEntityData(res.data);
          })
          .catch((err: AxiosError) => showErrorToast(err));

        break;
      case EntityType.DATABASE:
        getDatabaseDetailsByFQN(entityFQN, 'owner')
          .then((res: AxiosResponse) => {
            setEntityDetails(res.data);

            setEntityData(res.data);
          })
          .catch((err: AxiosError) => showErrorToast(err));

        break;
      case EntityType.DATABASE_SCHEMA:
        getDatabaseSchemaDetailsByFQN(entityFQN, 'owner')
          .then((res: AxiosResponse) => {
            setEntityDetails(res.data);

            setEntityData(res.data);
          })
          .catch((err: AxiosError) => showErrorToast(err));

        break;

      default:
        break;
    }
  };

  const PopoverTitle = () => {
    return (
      <Link data-testid="entitylink" to={getEntityLink(entityType, entityFQN)}>
        <button className="tw-text-info" disabled={AppState.isTourOpen}>
          <span>{entityFQN}</span>
        </button>
      </Link>
    );
  };

  const PopoverContent = () => {
    return (
      <div className="tw-w-80">
        <div className="tw-flex">
          <div data-testid="owner">
            <span>
              {entityData.owner ? (
                <span className="tw-flex">
                  <span className="tw-text-grey-muted">Owner:</span>{' '}
                  <span className="tw-flex tw-ml-1">
                    <ProfilePicture
                      displayName={getEntityName(entityData.owner)}
                      id=""
                      name={getEntityName(entityData.owner)}
                      width="20"
                    />
                    <span className="tw-ml-1">
                      {getEntityName(entityData.owner)}
                    </span>
                  </span>
                </span>
              ) : (
                <span className="tw-text-grey-muted">No Owner</span>
              )}
            </span>
          </div>
          <span className="tw-mx-1.5 tw-inline-block tw-text-gray-400">|</span>
          <div data-testid="tier">
            {entityTier ? (
              entityTier
            ) : (
              <span className="tw-text-grey-muted">No Tier</span>
            )}
          </div>
        </div>

        <div
          className="description-text tw-mt-1"
          data-testid="description-text">
          {entityData.description ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant={false}
              markdown={entityData.description}
            />
          ) : (
            <span className="tw-no-description">No description</span>
          )}
        </div>

        {entityData.tags ? (
          <div
            className="tw-mt-2 tw-flex tw-flex-wrap tw-gap-1"
            data-testid="tags">
            {entityTags.map((tag) => (
              <span
                className="tw-border tw-border-main tw-px-1 tw-rounded tw-text-xs"
                key={uniqueId()}>
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  const onMouseOver = () => {
    const entitydetails = AppState.entityData[entityFQN];
    if (entitydetails) {
      setEntityData(entitydetails);
    } else {
      getData();
    }
  };

  return (
    <Popover
      destroyTooltipOnHide
      align={{ targetOffset: [0, -10] }}
      content={<PopoverContent />}
      overlayClassName="ant-popover-card"
      title={<PopoverTitle />}
      trigger="hover"
      zIndex={9999}>
      <div onMouseOver={onMouseOver}>{children}</div>
    </Popover>
  );
};

export default EntityPopOverCard;
