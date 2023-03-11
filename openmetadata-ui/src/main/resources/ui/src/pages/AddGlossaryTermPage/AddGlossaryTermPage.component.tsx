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
import AddGlossaryTerm from 'components/AddGlossaryTerm/AddGlossaryTerm.component';
import { TitleBreadcrumbProps } from 'components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainerV1 from 'components/containers/PageContainerV1';
import Loader from 'components/Loader/Loader';
import { usePermissionProvider } from 'components/PermissionProvider/PermissionProvider';
import { ResourceEntity } from 'components/PermissionProvider/PermissionProvider.interface';
import { cloneDeep, get, isEmpty, isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import {
  addGlossaryTerm,
  getGlossariesByName,
  getGlossaryTermByFQN,
} from 'rest/glossaryAPI';
import { getQuotedGlossaryName } from 'utils/GlossaryUtils';
import { CreateGlossaryTerm } from '../../generated/api/data/createGlossaryTerm';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { Operation } from '../../generated/entity/policies/policy';
import Fqn from '../../utils/Fqn';
import { checkPermission } from '../../utils/PermissionsUtils';
import { getGlossaryPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const AddGlossaryTermPage = () => {
  const { glossaryName, glossaryTermsFQN } =
    useParams<{ [key: string]: string }>();
  const { t } = useTranslation();
  const history = useHistory();
  const { permissions } = usePermissionProvider();
  const [status, setStatus] = useState<LoadingState>('initial');
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryData, setGlossaryData] = useState<Glossary>();
  const [slashedBreadcrumb, setSlashedBreadcrumb] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);

  const [parentGlossaryData, setParentGlossaryData] = useState<GlossaryTerm>();

  const createPermission = useMemo(
    () =>
      checkPermission(
        Operation.Create,
        ResourceEntity.GLOSSARY_TERM,
        permissions
      ),
    [permissions]
  );

  const getFqn = (fqn: string) => {
    if (isEmpty(parentGlossaryData)) {
      return getQuotedGlossaryName(fqn);
    }

    return fqn;
  };

  const goToGlossaryPath = (path: string) => {
    history.push(path);
  };

  const goToGlossary = () => {
    const fqn = glossaryTermsFQN || glossaryName || '';
    goToGlossaryPath(getGlossaryPath(getFqn(fqn)));
  };

  const handleCancel = () => {
    goToGlossary();
  };

  const handleSaveFailure = (
    error: AxiosError | string,
    fallbackText?: string
  ) => {
    showErrorToast(error, fallbackText);
    setStatus('initial');
  };

  const onSave = (data: CreateGlossaryTerm) => {
    setStatus('waiting');
    addGlossaryTerm(data)
      .then((res) => {
        if (res.data) {
          setStatus('success');
          setTimeout(() => {
            setStatus('initial');
            goToGlossary();
          }, 500);
        } else {
          handleSaveFailure(
            t('server.add-entity-error', {
              entity: t('label.glossary-term'),
            })
          );
        }
      })
      .catch((err: AxiosError) => {
        handleSaveFailure(
          err,
          t('server.add-entity-error', {
            entity: t('label.glossary-term'),
          })
        );
      });
  };

  const fetchGlossaryData = () => {
    getGlossariesByName(glossaryName, ['tags', 'owner', 'reviewers'])
      .then((res) => {
        if (res) {
          setGlossaryData(res);
        } else {
          setGlossaryData(undefined);
          showErrorToast(
            t('server.entity-fetch-error', {
              entity: t('label.glossary'),
            })
          );
        }
      })
      .catch((err: AxiosError) => {
        setGlossaryData(undefined);
        showErrorToast(
          err,
          t('server.entity-fetch-error', {
            entity: t('label.glossary'),
          })
        );
      })
      .finally(() => setIsLoading(false));
  };

  const fetchGlossaryTermsByName = (name: string) => {
    getGlossaryTermByFQN(name, [
      'children',
      'relatedTerms',
      'reviewers',
      'tags',
    ])
      .then((res) => {
        if (res) {
          setParentGlossaryData(res);
        } else {
          setParentGlossaryData(undefined);
          showErrorToast(
            t('server.entity-fetch-error', {
              entity: t('label.glossary-term'),
            })
          );
        }
      })
      .catch((err: AxiosError) => {
        setParentGlossaryData(undefined);
        const errMsg = get(err, 'response.data.message', '');
        showErrorToast(
          errMsg ||
            t('server.entity-fetch-error', {
              entity: t('label.glossary-term'),
            })
        );
      });
  };

  useEffect(() => {
    fetchGlossaryData();
  }, [glossaryName]);

  useEffect(() => {
    if (glossaryTermsFQN) {
      fetchGlossaryTermsByName(glossaryTermsFQN);
    }
  }, [glossaryTermsFQN]);

  useEffect(() => {
    let breadcrumb = [];

    if (isUndefined(glossaryTermsFQN)) {
      breadcrumb.push({
        name: Fqn.quoteName(glossaryName),
        url: getGlossaryPath(getQuotedGlossaryName(glossaryName)),
      });
    } else {
      breadcrumb = Fqn.split(glossaryTermsFQN).map((fqn, i, arr) => {
        const cloneArr = cloneDeep(arr);
        if (i === 0) {
          return {
            name: glossaryName,
            url: getGlossaryPath(glossaryName),
          };
        }

        return {
          name: fqn,
          url: getGlossaryPath(cloneArr.splice(0, i + 1).join('.')),
        };
      });
    }

    setSlashedBreadcrumb([
      {
        name: t('label.glossary'),
        url: getGlossaryPath(),
      },
      ...breadcrumb,
      {
        name: t('label.add-entity', { entity: t('label.glossary-term') }),
        url: '',
        activeTitle: true,
      },
    ]);
  }, [glossaryTermsFQN, glossaryName]);

  return (
    <PageContainerV1>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="self-center">
          <AddGlossaryTerm
            allowAccess={createPermission}
            glossaryData={glossaryData as Glossary}
            parentGlossaryData={parentGlossaryData}
            saveState={status}
            slashedBreadcrumb={slashedBreadcrumb}
            onCancel={handleCancel}
            onSave={onSave}
          />
        </div>
      )}
    </PageContainerV1>
  );
};

export default AddGlossaryTermPage;
