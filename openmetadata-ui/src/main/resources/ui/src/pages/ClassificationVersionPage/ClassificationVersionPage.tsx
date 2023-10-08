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

import { isEmpty, toString } from 'lodash';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import ClassificationDetails from '../../components/ClassificationDetails/ClassificationDetails';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import { PagingHandlerParams } from '../../components/common/next-previous/NextPrevious.interface';
import PageLayoutV1 from '../../components/containers/PageLayoutV1';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../../components/Loader/Loader';
import { usePermissionProvider } from '../../components/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../components/PermissionProvider/PermissionProvider.interface';
import { FQN_SEPARATOR_CHAR } from '../../constants/char.constants';
import { INITIAL_PAGING_VALUE, PAGE_SIZE } from '../../constants/constants';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { Classification } from '../../generated/entity/classification/classification';
import { Tag } from '../../generated/entity/classification/tag';
import { EntityHistory } from '../../generated/type/entityHistory';
import { Paging } from '../../generated/type/paging';
import {
  getClassificationByName,
  getClassificationVersionData,
  getClassificationVersionsList,
  getTags,
} from '../../rest/tagAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getClassificationDetailsPath,
  getClassificationVersionsPath,
} from '../../utils/RouterUtils';

function ClassificationVersionPage() {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn: tagCategoryName, version } =
    useParams<{ fqn: string; version: string }>();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [currentVersionData, setCurrentVersionData] = useState<Classification>(
    {} as Classification
  );
  const [classificationId, setClassificationId] = useState<string>('');
  const [tags, setTags] = useState<Tag[]>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [classificationPermissions, setClassificationPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [paging, setPaging] = useState<Paging>({} as Paging);
  const [currentPage, setCurrentPage] = useState<number>(INITIAL_PAGING_VALUE);
  const [isTagsLoading, setIsTagsLoading] = useState(false);
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  const classificationName = useMemo(
    () => tagCategoryName.split(FQN_SEPARATOR_CHAR)[0],
    [tagCategoryName]
  );

  const viewVersionPermission = useMemo(
    () =>
      classificationPermissions.ViewAll || classificationPermissions.ViewBasic,
    [classificationPermissions]
  );

  const fetchResourcePermission = useCallback(async () => {
    try {
      setIsLoading(true);
      const permission = await getEntityPermissionByFqn(
        ResourceEntity.CLASSIFICATION,
        classificationName
      );

      setClassificationPermissions(permission);
    } finally {
      setIsLoading(false);
    }
  }, [classificationName, getEntityPermissionByFqn]);

  const fetchVersionsList = async () => {
    setIsLoading(true);
    try {
      const { id } = await getClassificationByName(classificationName);

      setClassificationId(id ?? '');

      const versions = await getClassificationVersionsList(id ?? '');

      setVersionList(versions);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchCurrentVersionData = useCallback(
    async (id: string) => {
      try {
        setIsVersionDataLoading(true);
        if (viewVersionPermission) {
          const response = await getClassificationVersionData(id, version);

          setCurrentVersionData(response);
        }
      } finally {
        setIsVersionDataLoading(false);
      }
    },
    [viewVersionPermission, version]
  );

  const fetchClassificationChildren = async (
    currentClassificationName: string,
    paging?: Paging
  ) => {
    setIsTagsLoading(true);
    setTags([]);
    try {
      const tagsResponse = await getTags({
        arrQueryFields: ['usageCount'],
        parent: currentClassificationName,
        after: paging?.after,
        before: paging?.before,
        limit: PAGE_SIZE,
      });
      setTags(tagsResponse.data);
      setPaging(tagsResponse.paging);
    } catch (error) {
      setTags([]);
    } finally {
      setIsTagsLoading(false);
    }
  };

  const handlePageChange = useCallback(
    ({ cursorType, currentPage }: PagingHandlerParams) => {
      if (cursorType) {
        const pagination = {
          [cursorType]: paging[cursorType as keyof Paging] as string,
          total: paging.total,
        } as Paging;

        setCurrentPage(currentPage);
        fetchClassificationChildren(classificationName, pagination);
      }
    },
    [fetchClassificationChildren, paging, classificationName]
  );

  const versionHandler = useCallback(
    (newVersion = version) => {
      history.push(
        getClassificationVersionsPath(classificationName, toString(newVersion))
      );
    },
    [classificationName]
  );

  const backHandler = useCallback(() => {
    history.push(getClassificationDetailsPath(classificationName));
  }, []);

  useEffect(() => {
    if (!isEmpty(classificationName)) {
      fetchResourcePermission();
    }
  }, [classificationName]);

  useEffect(() => {
    if (viewVersionPermission) {
      fetchVersionsList();
    }
  }, [classificationName, viewVersionPermission]);

  useEffect(() => {
    if (classificationId) {
      fetchCurrentVersionData(classificationId);
    }
  }, [version, classificationId]);

  useEffect(() => {
    if (!isEmpty(currentVersionData)) {
      fetchClassificationChildren(classificationName);
    }
  }, [currentVersionData]);

  const versionComponent = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return <ErrorPlaceHolder type={ERROR_PLACEHOLDER_TYPE.PERMISSION} />;
    }

    return (
      <>
        <div className="version-data">
          {isVersionDataLoading ? (
            <Loader />
          ) : (
            <ClassificationDetails
              isVersionView
              classificationPermissions={classificationPermissions}
              currentClassification={currentVersionData}
              currentPage={currentPage}
              handlePageChange={handlePageChange}
              isTagsLoading={isTagsLoading}
              paging={paging}
              tags={tags}
            />
          )}
        </div>

        <EntityVersionTimeLine
          currentVersion={toString(version)}
          versionHandler={versionHandler}
          versionList={versionList}
          onBack={backHandler}
        />
      </>
    );
  };

  return (
    <PageLayoutV1
      className="version-page-container"
      pageTitle={t('label.entity-version-detail-plural', {
        entity: t('label.classification'),
      })}>
      {versionComponent()}
    </PageLayoutV1>
  );
}

export default ClassificationVersionPage;
