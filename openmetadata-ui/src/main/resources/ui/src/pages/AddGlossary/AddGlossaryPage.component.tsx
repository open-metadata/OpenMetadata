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

import { AxiosError } from 'axios';
import AddGlossary from 'components/AddGlossary/AddGlossary.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { ERROR_MESSAGE } from 'constants/constants';
import React, {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { addGlossaries } from 'rest/glossaryAPI';
import { getIsErrorMatch } from 'utils/CommonUtils';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { Operation } from '../../generated/entity/policies/policy';
import jsonData from '../../jsons/en';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../utils/RouterUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddGlossaryPage: FunctionComponent = () => {
  const history = useHistory();
  const { permissions } = usePermissionProvider();
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const { t } = useTranslation();
  const createPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const goToGlossary = (name = '') => {
    history.push(getGlossaryPath(name));
  };

  const handleCancel = useCallback(() => {
    goToGlossary();
  }, []);

  const handleSaveFailure = (
    error: AxiosError | string,
    fallbackText?: string
  ) => {
    showErrorToast(error, fallbackText);
  };

  const onSave = useCallback(async (data: CreateGlossary) => {
    setIsLoading(true);
    try {
      const res = await addGlossaries(data);
      goToGlossary(res.name);
    } catch (error) {
      handleSaveFailure(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.glossary'),
              name: data.name,
            })
          : (error as AxiosError),
        jsonData['api-error-messages']['add-glossary-error']
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchTags = () => {
    setIsTagLoading(true);
    getClassifications()
      .then(async (res) => {
        if (res.data) {
          const tagList = await getTaglist(res.data);
          setTagList(tagList);
        } else {
          showErrorToast(jsonData['api-error-messages']['fetch-tags-error']);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['fetch-tags-error']);
      })
      .finally(() => {
        setIsTagLoading(false);
      });
  };

  useEffect(() => {
    setSlashedBreadcrumb([
      {
        name: t('label.glossary'),
        url: getGlossaryPath(),
      },
      {
        name: t('label.add-entity', {
          entity: t('label.glossary'),
        }),
        url: '',
        activeTitle: true,
      },
    ]);
  }, []);

  return (
    <PageContainerV1>
      <div className="self-center">
        <AddGlossary
          allowAccess={createPermission}
          fetchTags={fetchTags}
          header={t('label.add-entity', {
            entity: t('label.glossary'),
          })}
          isLoading={isLoading}
          isTagLoading={isTagLoading}
          slashedBreadcrumb={slashedBreadcrumb}
          tagList={tagList}
          onCancel={handleCancel}
          onSave={onSave}
        />
      </div>
    </PageContainerV1>
  );
};

export default AddGlossaryPage;
