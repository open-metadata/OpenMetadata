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

import { Button, Card, Tabs } from 'antd';
import { AxiosError, AxiosResponse } from 'axios';
import { capitalize, isEqual, isNil, uniqueId } from 'lodash';
import { Diff, EditorContentRef, EntityTags } from 'Models';
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { getTableDetailsByFQN } from '../../axiosAPIs/tableAPI';
import ProfilePicture from '../../components/common/ProfilePicture/ProfilePicture';
import RichTextEditor from '../../components/common/rich-text-editor/RichTextEditor';
import TitleBreadcrumb from '../../components/common/title-breadcrumb/title-breadcrumb.component';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
} from '../../constants/constants';
import { FqnPart } from '../../enums/entity.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { EntityReference } from '../../generated/type/entityReference';
import {
  getEntityName,
  getPartialNameFromTableFQN,
} from '../../utils/CommonUtils';
import { defaultFields as tableFields } from '../../utils/DatasetDetailsUtils';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { getTagsWithoutTier, getTierTags } from '../../utils/TableUtils';
import {
  fetchOptions,
  getColumnObject,
  getDescriptionDiff,
} from '../../utils/TasksUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import Assignees from './Assignees';
import { cardStyles } from './TaskPage.styles';
import TaskPageLayout from './TaskPageLayout';
import { EntityData, Option } from './TasksPage.interface';

export const DescriptionTabs = ({
  description,
  suggestion,
}: {
  description: string;
  suggestion: string;
}) => {
  const { TabPane } = Tabs;
  const markdownRef = useRef<EditorContentRef>();

  const [diffs, setDiffs] = useState<Diff[]>([]);
  const [activeTab, setActiveTab] = useState<string>('3');

  const onChange = (key: string) => {
    setActiveTab(key);
    if (isEqual(key, '2')) {
      const newDescription = markdownRef.current?.getEditorContent();
      if (newDescription) {
        setDiffs(getDescriptionDiff(description, newDescription));
      }
    }
  };

  const DiffView = ({ diffArr }: { diffArr: Diff[] }) => {
    const elements = diffArr.map((diff) => {
      if (diff.added) {
        return (
          <ins className="diff-added" key={uniqueId()}>
            {diff.value}
          </ins>
        );
      }
      if (diff.removed) {
        return (
          <del
            key={uniqueId()}
            style={{ color: '#b30000', background: '#fadad7' }}>
            {diff.value}
          </del>
        );
      }

      return <div key={uniqueId()}>{diff.value}</div>;
    });

    return (
      <div className="tw-w-full tw-border tw-border-main tw-p-2 tw-rounded tw-my-3 tw-max-h-52 tw-overflow-y-auto">
        <pre className="tw-whitespace-pre-wrap">
          {diffArr.length ? (
            elements
          ) : (
            <span className="tw-text-grey-muted">No diff available</span>
          )}
        </pre>
      </div>
    );
  };

  return (
    <Tabs
      activeKey={activeTab}
      className="ant-tabs-description"
      size="small"
      type="card"
      onChange={onChange}>
      <TabPane key="1" tab="Current">
        <RichTextEditor
          readonly
          className="tw-my-0"
          height="208px"
          initialValue={description}
        />
      </TabPane>
      <TabPane key="2" tab="Diff">
        <DiffView diffArr={diffs} />
      </TabPane>
      <TabPane key="3" tab="New">
        <RichTextEditor
          className="tw-my-0"
          height="208px"
          initialValue={suggestion}
          ref={markdownRef}
        />
      </TabPane>
    </Tabs>
  );
};

const UpdateDescription = () => {
  const location = useLocation();
  const history = useHistory();

  const { entityType, entityFQN } = useParams<{ [key: string]: string }>();
  const queryParams = new URLSearchParams(location.search);

  const field = queryParams.get('field');
  const value = queryParams.get('value');

  const [entityData, setEntityData] = useState<EntityData>({} as EntityData);
  const [options, setOptions] = useState<Option[]>([]);
  const [assignees, setAssignees] = useState<Array<Option>>([]);

  const entityTier = useMemo(() => {
    const tierFQN = getTierTags(entityData.tags || [])?.tagFQN;

    return tierFQN?.split(FQN_SEPARATOR_CHAR)[1];
  }, [entityData.tags]);

  const entityTags = useMemo(() => {
    const tags: EntityTags[] = getTagsWithoutTier(entityData.tags || []) || [];

    return tags.map((tag) => `#${tag.tagFQN}`).join(' ');
  }, [entityData.tags]);

  const getSanitizeValue = value?.replaceAll(/^"|"$/g, '') || '';

  const fetchTableDetails = () => {
    getTableDetailsByFQN(entityFQN, tableFields)
      .then((res: AxiosResponse) => {
        setEntityData(res.data);
      })
      .catch((err: AxiosError) => {
        showErrorToast(err);
      });
  };

  const back = () => history.goBack();

  const getBreadCrumb = () => {
    return [
      {
        name: getEntityName(entityData.service),
        url: getEntityName(entityData.service)
          ? getServiceDetailsPath(
              entityData.service.name || '',
              ServiceCategory.DATABASE_SERVICES
            )
          : '',
        imgSrc: entityData.serviceType
          ? serviceTypeLogo(entityData.serviceType || '')
          : undefined,
      },
      {
        name: getPartialNameFromTableFQN(
          entityData.database?.fullyQualifiedName || '',
          [FqnPart.Database]
        ),
        url: getDatabaseDetailsPath(
          entityData.database?.fullyQualifiedName || ''
        ),
      },
      {
        name: getPartialNameFromTableFQN(
          entityData.databaseSchema?.fullyQualifiedName || '',
          [FqnPart.Schema]
        ),
        url: getDatabaseSchemaDetailsPath(
          entityData.databaseSchema?.fullyQualifiedName || ''
        ),
      },
      {
        name: getEntityName(entityData as unknown as EntityReference),
        url: '',
        activeTitle: true,
      },
    ];
  };

  const getColumnDetails = useCallback(() => {
    if (!isNil(field) && !isNil(value) && field === 'columns') {
      const column = getSanitizeValue.split(FQN_SEPARATOR_CHAR).slice(-1);

      const columnObject = getColumnObject(column[0], entityData.columns || []);

      return (
        <div data-testid="column-details">
          <p className="tw-font-semibold">Column Details</p>
          <p>
            <span className="tw-text-grey-muted">Type:</span>{' '}
            <span>{columnObject.dataTypeDisplay}</span>
          </p>
          <p>{columnObject?.tags?.map((tag) => `#${tag.tagFQN}`)?.join(' ')}</p>
        </div>
      );
    } else {
      return null;
    }
  }, [entityData.columns]);

  const onSearch = (query: string) => {
    fetchOptions(query, setOptions);
  };

  useEffect(() => {
    fetchTableDetails();
  }, [entityFQN, entityType]);

  useEffect(() => {
    const owner = entityData.owner;
    if (owner) {
      setAssignees([
        {
          label: getEntityName(owner),
          value: owner.name || '',
          type: owner.type,
        },
      ]);
    }
  }, [entityData]);

  return (
    <TaskPageLayout>
      <TitleBreadcrumb titleLinks={getBreadCrumb()} />
      <div className="tw-grid tw-grid-cols-3 tw-gap-x-2">
        <Card
          className="tw-col-span-2"
          key="update-description"
          style={{ ...cardStyles }}
          title={`Update description for ${getSanitizeValue || entityType}`}>
          <div data-testid="assignees">
            <span className="tw-text-grey-muted">Assignees:</span>{' '}
            <Assignees
              assignees={assignees}
              options={options}
              onChange={setAssignees}
              onSearch={onSearch}
            />
          </div>
          <div data-testid="description-tabs">
            <span>Description:</span>{' '}
            <DescriptionTabs
              description={entityData.description || ''}
              suggestion=""
            />
          </div>

          <div className="tw-flex tw-justify-end" data-testid="cta-buttons">
            <Button className="ant-btn-link-custom" type="link" onClick={back}>
              Back
            </Button>
            <Button className="ant-btn-primary-custom" type="primary">
              Submit
            </Button>
          </div>
        </Card>

        <div className="tw-pl-2" data-testid="entity-details">
          <h6 className="tw-text-base">{capitalize(entityType)} Details</h6>
          <div className="tw-flex tw-mb-4">
            <span className="tw-text-grey-muted">Owner:</span>{' '}
            <span>
              {entityData.owner ? (
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
              ) : (
                <span className="tw-text-grey-muted tw-ml-1">No Owner</span>
              )}
            </span>
          </div>

          <p data-testid="tier">
            {entityTier ? (
              entityTier
            ) : (
              <span className="tw-text-grey-muted">No Tier</span>
            )}
          </p>

          <p data-testid="tags">{entityTags}</p>

          {getColumnDetails()}
        </div>
      </div>
    </TaskPageLayout>
  );
};

export default UpdateDescription;
