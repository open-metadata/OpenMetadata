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
import { Typography } from 'antd';
import { useForm } from 'antd/lib/form/Form';
import { AxiosError } from 'axios';
import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ERROR_MESSAGE } from '../../../constants/constants';
import { CreateDataProduct } from '../../../generated/api/domains/createDataProduct';
import { CreateDomain } from '../../../generated/api/domains/createDomain';
import { addDomains } from '../../../rest/domainAPI';
import { getIsErrorMatch } from '../../../utils/CommonUtils';
import { getDomainPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ResizablePanels from '../../common/ResizablePanels/ResizablePanels';
import TitleBreadcrumb from '../../common/title-breadcrumb/title-breadcrumb.component';
import AddDomainForm from '../AddDomainForm/AddDomainForm.component';
import { DomainFormType } from '../DomainPage.interface';
import { useDomainProvider } from '../DomainProvider/DomainProvider';
import './add-domain.less';

const AddDomain = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const [form] = useForm();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { refreshDomains } = useDomainProvider();

  const goToDomain = (name = '') => {
    history.push(getDomainPath(name));
  };

  const handleCancel = useCallback(() => {
    goToDomain();
  }, []);

  const slashedBreadcrumb = [
    {
      name: t('label.domain'),
      url: getDomainPath(),
    },
    {
      name: t('label.add-entity', {
        entity: t('label.domain'),
      }),
      url: '',
      activeTitle: true,
    },
  ];

  const onSave = useCallback(
    async (formData: CreateDomain | CreateDataProduct) => {
      setIsLoading(true);
      try {
        const res = await addDomains(formData as CreateDomain);
        refreshDomains();
        goToDomain(res.fullyQualifiedName ?? '');
      } catch (error) {
        showErrorToast(
          getIsErrorMatch(error as AxiosError, ERROR_MESSAGE.alreadyExist)
            ? t('server.entity-already-exist', {
                entity: t('label.domain'),
                entityPlural: t('label.domain-lowercase-plural'),
                name: formData.name,
              })
            : (error as AxiosError),
          t('server.add-entity-error', {
            entity: t('label.domain-lowercase'),
          })
        );
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const rightPanel = (
    <div data-testid="right-panel">
      <Typography.Title level={5}>
        {t('label.configure-entity', {
          entity: t('label.domain'),
        })}
      </Typography.Title>
      <Typography.Text className="mb-5">
        {t('message.create-new-domain-guide')}
      </Typography.Text>
    </div>
  );

  return (
    <ResizablePanels
      firstPanel={{
        children: (
          <div className="max-width-md w-9/10 domain-form-container">
            <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
            <Typography.Title
              className="m-t-md"
              data-testid="form-heading"
              level={5}>
              {t('label.add-entity', {
                entity: t('label.domain'),
              })}
            </Typography.Title>
            <AddDomainForm
              formRef={form}
              isFormInDialog={false}
              loading={isLoading}
              type={DomainFormType.DOMAIN}
              onCancel={handleCancel}
              onSubmit={onSave}
            />
          </div>
        ),
        minWidth: 700,
        flex: 0.7,
      }}
      pageTitle={t('label.add-entity', {
        entity: t('label.domain'),
      })}
      secondPanel={{
        children: rightPanel,
        className: 'p-md service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default AddDomain;
