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

import { Button, Card, Col, Row, Skeleton, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty, isUndefined } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useHistory } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/NextPrevious/NextPrevious';
import { NextPreviousProps } from '../../components/common/NextPrevious/NextPrevious.interface';
import RichTextEditorPreviewer from '../../components/common/RichTextEditor/RichTextEditorPreviewer';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TitleBreadcrumbProps } from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../constants/GlobalSettings.constants';
import { PAGE_HEADERS } from '../../constants/PageHeaders.constant';
import { ERROR_PLACEHOLDER_TYPE } from '../../enums/common.enum';
import { Persona } from '../../generated/entity/teams/persona';
import { PageType } from '../../generated/system/ui/page';
import { Paging } from '../../generated/type/paging';
import { usePaging } from '../../hooks/paging/usePaging';
import { getAllPersonas } from '../../rest/PersonaAPI';
import { Transi18next } from '../../utils/CommonUtils';
import { getEntityName } from '../../utils/EntityUtils';
import {
  getCustomizePagePath,
  getSettingPageEntityBreadCrumb,
} from '../../utils/GlobalSettingsUtils';
import { getSettingPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import './custom-page-settings.less';

export const CustomPageSettings = () => {
  const { t } = useTranslation();
  const history = useHistory();

  const [isLoading, setIsLoading] = useState(true);

  const [personas, setPersonas] = useState<Persona[]>();
  const {
    currentPage,
    handlePageChange,
    handlePageSizeChange,
    pageSize,
    paging,
    handlePagingChange,
    showPagination,
  } = usePaging();

  const breadcrumbs: TitleBreadcrumbProps['titleLinks'] = useMemo(
    () =>
      getSettingPageEntityBreadCrumb(
        GlobalSettingsMenuCategory.OPEN_METADATA,
        t('label.customize-entity', {
          entity: t('label.landing-page'),
        })
      ),
    []
  );

  const fetchPersonas = async (params?: Partial<Paging>) => {
    try {
      setIsLoading(true);
      const { data, paging } = await getAllPersonas({
        after: params?.after,
        before: params?.before,
        limit: pageSize,
      });
      setPersonas(data);
      handlePagingChange(paging);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, [pageSize]);

  const handleCustomisePersona = (persona: Persona) => {
    if (persona.fullyQualifiedName) {
      history.push(
        getCustomizePagePath(persona.fullyQualifiedName, PageType.LandingPage)
      );
    }
  };

  const handlePersonaPageChange: NextPreviousProps['pagingHandler'] = ({
    currentPage,
    cursorType,
  }) => {
    handlePageChange(currentPage);
    if (cursorType) {
      fetchPersonas({ [cursorType]: paging[cursorType] });
    }
  };

  const errorPlaceHolder = useMemo(
    () => (
      <Col className="mt-24 text-center" span={24}>
        <ErrorPlaceHolder
          className="m-t-lg"
          type={ERROR_PLACEHOLDER_TYPE.CUSTOM}>
          <Typography.Paragraph className="w-max-500">
            <Transi18next
              i18nKey="message.no-persona-message"
              renderElement={
                <Link
                  style={{ color: '#1890ff' }}
                  to={getSettingPath(
                    GlobalSettingsMenuCategory.MEMBERS,
                    GlobalSettingOptions.PERSONA
                  )}
                />
              }
              values={{
                link: t('label.here-lowercase'),
              }}
            />
          </Typography.Paragraph>
        </ErrorPlaceHolder>
      </Col>
    ),
    []
  );

  const showErrorPlaceholder = useMemo(
    () => (isEmpty(personas) || isUndefined(personas)) && !isLoading,
    [personas, isLoading]
  );

  return (
    <PageLayoutV1
      pageTitle={t('label.customize-entity', {
        entity: t('label.landing-page'),
      })}>
      <Row
        className="customize-landing-page user-listing p-b-md page-container"
        data-testid="custom-page-setting-component"
        gutter={[16, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={breadcrumbs} />
        </Col>
        <Col span={18}>
          <PageHeader data={PAGE_HEADERS.CUSTOM_PAGE} />
        </Col>

        {isLoading
          ? [1, 2, 3].map((key) => (
              <Col key={key} span={8}>
                <Card>
                  <Skeleton active paragraph title />
                </Card>
              </Col>
            ))
          : personas?.map((persona) => (
              <Col key={persona.id} span={8}>
                <Card
                  bodyStyle={{ height: '100%' }}
                  className="h-full"
                  data-testid={`persona-details-card-${persona.name}`}
                  extra={
                    <Button
                      className="text-link-color"
                      data-testid="customize-page-button"
                      size="small"
                      type="text"
                      onClick={() => handleCustomisePersona(persona)}>
                      {t('label.customize-entity', {
                        entity: t('label.landing-page'),
                      })}
                    </Button>
                  }
                  title={getEntityName(persona)}>
                  {persona.description ? (
                    <RichTextEditorPreviewer
                      markdown={persona.description ?? ''}
                    />
                  ) : (
                    <Typography.Text className="text-grey-muted">
                      {t('label.no-description')}
                    </Typography.Text>
                  )}
                </Card>
              </Col>
            ))}

        {showErrorPlaceholder && errorPlaceHolder}

        <Col span={24}>
          {showPagination && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={pageSize}
              paging={paging}
              pagingHandler={handlePersonaPageChange}
              onShowSizeChange={handlePageSizeChange}
            />
          )}
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
