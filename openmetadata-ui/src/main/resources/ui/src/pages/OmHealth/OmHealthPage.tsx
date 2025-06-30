/*
 *  Copyright 2024 Collate.
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
import { Button, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { map, startCase } from 'lodash';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import ConnectionStepCard from '../../components/common/TestConnection/ConnectionStepCard/ConnectionStepCard';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ValidationResponse } from '../../generated/system/validationResponse';
import { fetchOMStatus } from '../../rest/miscAPI';
import { getSettingPageEntityBreadCrumb } from '../../utils/GlobalSettingsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

const OmHealthPage = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<boolean>(false);
  const [validationStatus, setValidationStatus] =
    useState<ValidationResponse>();
  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.PREFERENCES,
        t('label.health-check')
      ),
    []
  );

  const getHealthData = async () => {
    setLoading(true);
    try {
      const response = await fetchOMStatus();
      setValidationStatus(response);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    getHealthData();
  }, []);

  if (loading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.health-check')}>
      <Row className="bg-white p-lg border-radius-sm" gutter={[0, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={24}>
          <Row align="middle" justify="space-between">
            <Col>
              <PageHeader data={PAGE_HEADERS.OM_HEALTH} />
            </Col>
            <Col>
              <Button type="primary" onClick={getHealthData}>
                {t('label.refresh')}
              </Button>
            </Col>
          </Row>
        </Col>

        {validationStatus &&
          map(
            validationStatus,
            (validation, key) =>
              validation && (
                <Col data-testid={key} key={key} span={24}>
                  <ConnectionStepCard
                    isTestingConnection={false}
                    testConnectionStep={{
                      name: startCase(key),
                      mandatory: true,
                      description: validation.description ?? '',
                    }}
                    testConnectionStepResult={{
                      name: startCase(key),
                      passed: Boolean(validation.passed),
                      mandatory: true,
                      message: validation.passed
                        ? validation.message
                        : validation.description,
                      ...(!validation.passed
                        ? { errorLog: validation.message }
                        : {}),
                    }}
                  />
                </Col>
              )
          )}
      </Row>
    </PageLayoutV1>
  );
};

export default OmHealthPage;
