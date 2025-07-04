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

import { AxiosError } from 'axios';
import { isEmpty, toString } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ClassificationDetails from '../../components/Classifications/ClassificationDetails/ClassificationDetails';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import EntityVersionTimeLine from '../../components/Entity/EntityVersionTimeLine/EntityVersionTimeLine';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import {
  OperationPermission,
  ResourceEntity,
} from '../../context/PermissionProvider/PermissionProvider.interface';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { EntityType } from '../../enums/entity.enum';
import { Classification } from '../../generated/entity/classification/classification';
import { EntityHistory } from '../../generated/type/entityHistory';
import { useFqn } from '../../hooks/useFqn';
import {
  getClassificationByName,
  getClassificationVersionData,
  getClassificationVersionsList,
} from '../../rest/tagAPI';
import { DEFAULT_ENTITY_PERMISSION } from '../../utils/PermissionsUtils';
import {
  getClassificationDetailsPath,
  getClassificationVersionsPath,
} from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';

function ClassificationVersionPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { version } = useRequiredParams<{ version: string }>();
  const { fqn: classificationName } = useFqn();
  const { getEntityPermissionByFqn } = usePermissionProvider();
  const [currentVersionData, setCurrentVersionData] = useState<Classification>(
    {} as Classification
  );
  const [classificationId, setClassificationId] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [classificationPermissions, setClassificationPermissions] =
    useState<OperationPermission>(DEFAULT_ENTITY_PERMISSION);
  const [isVersionDataLoading, setIsVersionDataLoading] =
    useState<boolean>(true);
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
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
      } catch (error) {
        showErrorToast(error as AxiosError);
      } finally {
        setIsVersionDataLoading(false);
      }
    },
    [viewVersionPermission, version]
  );

  const versionHandler = useCallback(
    (newVersion = version) => {
      navigate(
        getClassificationVersionsPath(classificationName, toString(newVersion))
      );
    },
    [classificationName]
  );

  const backHandler = useCallback(() => {
    navigate(getClassificationDetailsPath(classificationName));
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

  const versionComponent = () => {
    if (isLoading) {
      return <Loader />;
    }

    if (!viewVersionPermission) {
      return (
        <ErrorPlaceHolder
          className="border-none"
          permissionValue={t('label.view-entity', {
            entity: t('label.classification-plural'),
          })}
          type={ERROR_PLACEHOLDER_TYPE.PERMISSION}
        />
      );
    }

    return (
      <>
        <div className="version-data" data-testid="version-data">
          {isVersionDataLoading ? (
            <Loader />
          ) : (
            <ClassificationDetails
              isVersionView
              classificationPermissions={classificationPermissions}
              currentClassification={currentVersionData}
            />
          )}
        </div>

        <EntityVersionTimeLine
          currentVersion={toString(version)}
          entityType={EntityType.CLASSIFICATION}
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
