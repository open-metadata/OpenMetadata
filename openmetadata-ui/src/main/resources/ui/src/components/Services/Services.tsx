/*
 *  Copyright 2022 Collate
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

import { Card, Col, Row } from 'antd';
import React, { Fragment } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getServiceDetailsPath, PAGE_SIZE, TITLE_FOR_NON_ADMIN_ACTION } from '../../constants/constants';
import { NoDataFoundPlaceHolder, servicesDisplayName } from '../../constants/services.const';
import { ServiceCategory } from '../../enums/service.enum';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { DataService } from '../../interface/service.interface';
import { getEntityName, getServiceLogo, showPagination } from '../../utils/CommonUtils';
import { getAddServicePath } from '../../utils/RouterUtils';
import { getOptionalFields } from '../../utils/ServiceUtils';
import { Button } from '../buttons/Button/Button';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { leftPanelAntCardStyle } from '../containers/PageLayout';

interface ServicesProps {
  serviceData: DataService[];
  serviceName: ServiceCategory;
  paging: Paging;
  currentPage: number;
  onPageChange: (cursorType: string | number, activePage?: number) => void;
}

const Services = ({
  serviceData,
  serviceName,
  paging,
  currentPage,
  onPageChange,
}: ServicesProps) => {
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const handleAddServiceClick = () => {
    history.push(getAddServicePath(serviceName));
  };

  return (
    <div className="tw-py-1" data-testid="services-container">
      {serviceData.length ? (
        <Fragment>
          <div className="tw-flex tw-justify-end" data-testid="header">
            <NonAdminAction
              position="bottom"
              title={TITLE_FOR_NON_ADMIN_ACTION}>
              <Button
                className="tw-h-8 tw-rounded tw-mb-2"
                data-testid="add-new-service-button"
                disabled={!isAdminUser && !isAuthDisabled}
                size="small"
                theme="primary"
                variant="contained"
                onClick={handleAddServiceClick}>
                Add New Service
              </Button>
            </NonAdminAction>
          </div>
          <Row data-testid="data-container" gutter={[16, 16]}>
            {serviceData.map((service, index) => (
              <Col key={index} span={6}>
                <Card size="small" style={leftPanelAntCardStyle}>
                  <div
                    className="tw-flex tw-justify-between tw-text-grey-muted"
                    data-testid="service-card">
                    <div className="tw-flex tw-flex-col tw-justify-between tw-truncate">
                      <div>
                        <Link
                          to={getServiceDetailsPath(service.name, serviceName)}>
                          <button>
                            <h6
                              className="tw-text-base tw-text-grey-body tw-font-medium tw-text-left tw-truncate tw-w-48"
                              data-testid={`service-name-${getEntityName(
                                service
                              )}`}
                              title={getEntityName(service)}>
                              {getEntityName(service)}
                            </h6>
                          </button>
                        </Link>
                        <div
                          className="tw-text-grey-body tw-pb-1 tw-break-all description-text"
                          data-testid="service-description">
                          {service.description ? (
                            <RichTextEditorPreviewer
                              enableSeeMoreVariant={false}
                              markdown={service.description}
                            />
                          ) : (
                            <span className="tw-no-description">
                              No description
                            </span>
                          )}
                        </div>
                        {getOptionalFields(service, serviceName)}
                      </div>
                      <div className="" data-testid="service-type">
                        <label className="tw-mb-0">Type:</label>
                        <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                          {service.serviceType}
                        </span>
                      </div>
                    </div>
                    <div className="tw-flex tw-flex-col tw-justify-between tw-flex-none">
                      <div
                        className="tw-flex tw-justify-end"
                        data-testid="service-icon">
                        {getServiceLogo(service.serviceType || '', 'tw-h-8')}
                      </div>
                    </div>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
          {showPagination(paging) && (
            <NextPrevious
              currentPage={currentPage}
              pageSize={PAGE_SIZE}
              paging={paging}
              pagingHandler={onPageChange}
              totalCount={paging.total}
            />
          )}
        </Fragment>
      ) : (
        <div className="tw-flex tw-items-center tw-flex-col">
          <div className="tw-mt-24">
            <img alt="No Service" src={NoDataFoundPlaceHolder} width={250} />
          </div>
          <div className="tw-mt-11">
            <p className="tw-text-lg tw-text-center">No services found</p>
            <div className="tw-text-lg tw-text-center">
              <NonAdminAction
                position="bottom"
                title={TITLE_FOR_NON_ADMIN_ACTION}>
                <Button
                  data-testid="add-service-button"
                  size="small"
                  theme="primary"
                  variant="outlined"
                  onClick={handleAddServiceClick}>
                  Click here
                </Button>
              </NonAdminAction>{' '}
              to add new {servicesDisplayName[serviceName]}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
