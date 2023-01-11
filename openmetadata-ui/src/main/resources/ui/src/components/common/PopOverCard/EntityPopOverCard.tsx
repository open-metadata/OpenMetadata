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

import { Button, Divider, Popover, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { uniqueId } from 'lodash';
import { EntityTags } from 'Models';
import React, { FC, HTMLAttributes, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { getDashboardByFqn } from 'rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from 'rest/databaseAPI';
import { getMlModelByFQN } from 'rest/mlModelAPI';
import { getPipelineByFqn } from 'rest/pipelineAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getTopicByFqn } from 'rest/topicsAPI';
import AppState from '../../../AppState';
import { FQN_SEPARATOR_CHAR } from '../../../constants/char.constants';
import { EntityType } from '../../../enums/entity.enum';
import { Dashboard } from '../../../generated/entity/data/dashboard';
import { Database } from '../../../generated/entity/data/database';
import { DatabaseSchema } from '../../../generated/entity/data/databaseSchema';
import { Mlmodel } from '../../../generated/entity/data/mlmodel';
import { Pipeline } from '../../../generated/entity/data/pipeline';
import { Table } from '../../../generated/entity/data/table';
import { Topic } from '../../../generated/entity/data/topic';
import { TagSource } from '../../../generated/type/tagLabel';
import { getEntityName } from '../../../utils/CommonUtils';
import SVGIcons from '../../../utils/SvgUtils';
import {
  getEntityLink,
  getTagsWithoutTier,
  getTierTags,
} from '../../../utils/TableUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ProfilePicture from '../ProfilePicture/ProfilePicture';
import RichTextEditorPreviewer from '../rich-text-editor/RichTextEditorPreviewer';

export type EntityData =
  | Table
  | Topic
  | Dashboard
  | Pipeline
  | Mlmodel
  | Database
  | DatabaseSchema;

interface Props extends HTMLAttributes<HTMLDivElement> {
  entityType: string;
  entityFQN: string;
}

const EntityPopOverCard: FC<Props> = ({ children, entityType, entityFQN }) => {
  const { t } = useTranslation();
  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);

  const entityTier = useMemo(() => {
    const tierFQN = getTierTags((entityData as Table).tags || [])?.tagFQN;

    return tierFQN?.split(FQN_SEPARATOR_CHAR)[1];
  }, [(entityData as Table).tags]);

  const entityTags = useMemo(() => {
    const tags: EntityTags[] =
      getTagsWithoutTier((entityData as Table).tags || []) || [];

    return tags.map((tag) =>
      tag.source === TagSource.Glossary ? tag.tagFQN : `#${tag.tagFQN}`
    );
  }, [(entityData as Table).tags]);

  const getData = () => {
    const setEntityDetails = (entityDetail: EntityData) => {
      AppState.entityData[entityFQN] = entityDetail;
    };

    const fields = 'tags,owner';

    let promise: Promise<EntityData> | null = null;

    switch (entityType) {
      case EntityType.TABLE:
        promise = getTableDetailsByFQN(entityFQN, fields);

        break;
      case EntityType.TOPIC:
        promise = getTopicByFqn(entityFQN, fields);

        break;
      case EntityType.DASHBOARD:
        promise = getDashboardByFqn(entityFQN, fields);

        break;
      case EntityType.PIPELINE:
        promise = getPipelineByFqn(entityFQN, fields);

        break;
      case EntityType.MLMODEL:
        promise = getMlModelByFQN(entityFQN, fields);

        break;
      case EntityType.DATABASE:
        promise = getDatabaseDetailsByFQN(entityFQN, 'owner');

        break;
      case EntityType.DATABASE_SCHEMA:
        promise = getDatabaseSchemaDetailsByFQN(entityFQN, 'owner');

        break;

      default:
        break;
    }

    if (promise) {
      promise
        .then((res) => {
          setEntityDetails(res);

          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));
    }
  };

  const PopoverTitle = () => {
    return (
      <Link data-testid="entitylink" to={getEntityLink(entityType, entityFQN)}>
        <Button
          className="p-0"
          disabled={AppState.isTourOpen}
          type="link"
          onClick={(e) => e.stopPropagation()}>
          <span>{entityFQN}</span>
        </Button>
      </Link>
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

  const PopoverContent = () => {
    useEffect(() => {
      onMouseOver();
    }, []);

    return (
      <div className="w-500">
        <Space align="center" size="small">
          <div data-testid="owner">
            {entityData.owner ? (
              <Space align="center" size="small">
                <ProfilePicture
                  displayName={getEntityName(entityData.owner)}
                  id={entityData.name}
                  name={getEntityName(entityData.owner)}
                  width="20"
                />
                <Typography.Text className="text-xs">
                  {getEntityName(entityData.owner)}
                </Typography.Text>
              </Space>
            ) : (
              <Typography.Text className="text-xs text-grey-muted">
                {t('label.no-entity', {
                  entity: t('label.owner'),
                })}
              </Typography.Text>
            )}
          </div>
          <span className="text-grey-muted">|</span>
          <Typography.Text
            className="text-xs text-grey-muted"
            data-testid="tier">
            {entityTier
              ? entityTier
              : t('label.no-entity', {
                  entity: t('label.tier'),
                })}
          </Typography.Text>
        </Space>

        <div className="description-text m-t-sm" data-testid="description-text">
          {entityData.description ? (
            <RichTextEditorPreviewer
              enableSeeMoreVariant={false}
              markdown={entityData.description}
            />
          ) : (
            <Typography.Text className="text-xs text-grey-muted">
              {t('label.no-entity', {
                entity: t('label.description'),
              })}
            </Typography.Text>
          )}
        </div>

        {entityTags.length ? (
          <>
            <Divider className="m-b-xs m-t-sm" />
            <div className="d-flex flex-start">
              <span className="w-5 m-r-xs">
                <SVGIcons alt="icon-tag" icon="icon-tag-grey" width="14" />
              </span>

              <Space wrap align="center" size={[16, 0]}>
                {entityTags.map((tag) => (
                  <span className="text-xs font-medium" key={uniqueId()}>
                    {tag}
                  </span>
                ))}
              </Space>
            </div>
          </>
        ) : null}
      </div>
    );
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
      {children}
    </Popover>
  );
};

export default EntityPopOverCard;
