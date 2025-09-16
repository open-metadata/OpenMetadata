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
import {
  FunctionComponent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import AddGlossary from '../../components/Glossary/AddGlossary/AddGlossary.component';
import { ERROR_MESSAGE } from '../../constants/constants';
import { usePermissionProvider } from '../../context/PermissionProvider/PermissionProvider';
import { ResourceEntity } from '../../context/PermissionProvider/PermissionProvider.interface';
import { CreateGlossary } from '../../generated/api/data/createGlossary';
import { Operation } from '../../generated/entity/policies/policy';
import { withPageLayout } from '../../hoc/withPageLayout';
import { addGlossaries } from '../../rest/glossaryAPI';
import { getIsErrorMatch } from '../../utils/CommonUtils';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../utils/RouterUtils';
import { getClassifications, getTaglist } from '../../utils/TagsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddGlossaryPage: FunctionComponent = () => {
  const navigate = useNavigate();
  const { permissions } = usePermissionProvider();
  const { t } = useTranslation();
  const [tagList, setTagList] = useState<Array<string>>([]);
  const [isTagLoading, setIsTagLoading] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const createPermission = useMemo(
    () =>
      checkPermission(Operation.Create, ResourceEntity.GLOSSARY, permissions),
    [permissions]
  );

  const goToGlossary = (name = '') => {
    navigate(getGlossaryPath(name));
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
      goToGlossary(res.fullyQualifiedName ?? '');
    } catch (error) {
      handleSaveFailure(
        getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
          ? t('server.entity-already-exist', {
              entity: t('label.glossary'),
              entityPlural: t('label.glossary-lowercase-plural'),
              name: data.name,
            })
          : (error as AxiosError),
        t('server.add-entity-error', {
          entity: t('label.glossary-lowercase'),
        })
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
          showErrorToast(
            t('server.entity-fetch-error', {
              entity: t('label.tag-plural'),
            })
          );
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.tag-plural'),
          })
        );
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
  );
};

export default withPageLayout(AddGlossaryPage);
