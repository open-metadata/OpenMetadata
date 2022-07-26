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

import { Card } from 'antd';
import { isNil } from 'lodash';
import { EntityReference } from 'Models';
import React, { Fragment } from 'react';
import { Link, useHistory } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import {
  getServiceDetailsPath,
  PAGE_SIZE,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import {
  NoDataFoundPlaceHolder,
  servicesDisplayName,
} from '../../constants/services.const';
import { ServiceCategory } from '../../enums/service.enum';
import { DashboardService } from '../../generated/entity/services/dashboardService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { MlmodelService } from '../../generated/entity/services/mlmodelService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { DataService } from '../../interface/service.interface';
import { getEntityName, getServiceLogo } from '../../utils/CommonUtils';
import { getDashboardURL } from '../../utils/DashboardServiceUtils';
import { getBrokers } from '../../utils/MessagingServiceUtils';
import { getAddServicePath } from '../../utils/RouterUtils';
import { Button } from '../buttons/Button/Button';
import NextPrevious from '../common/next-previous/NextPrevious';
import NonAdminAction from '../common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../common/rich-text-editor/RichTextEditorPreviewer';
import { leftPanelAntCardStyle } from '../containers/PageLayout';

interface ServicesProps {
  serviceData: DataService[];
  serviceName: string;
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
  const goToAddService = () => {
    history.push(getAddServicePath(serviceName));
  };
  const getOptionalFields = (service: DataService): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.MESSAGING_SERVICES: {
        const messagingService = service as MessagingService;

        return (
          <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
            <label className="tw-mb-0">Brokers:</label>
            <span
              className=" tw-ml-1 tw-font-normal tw-text-grey-body"
              data-testid="brokers">
              {getBrokers(messagingService.connection?.config)}
            </span>
          </div>
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        const dashboardService = service as DashboardService;

        return (
          <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
            <label className="tw-mb-0">URL:</label>
            <span
              className=" tw-ml-1 tw-font-normal tw-text-grey-body"
              data-testid="dashboard-url">
              {getDashboardURL(dashboardService.connection?.config)}
            </span>
          </div>
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        const pipelineService = service as PipelineService;

        return (
          <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
            <label className="tw-mb-0">URL:</label>
            <span
              className=" tw-ml-1 tw-font-normal tw-text-grey-body"
              data-testid="pipeline-url">
              {pipelineService.connection?.config?.hostPort || '--'}
            </span>
          </div>
        );
      }

      case ServiceCategory.ML_MODAL_SERVICES: {
        const mlmodel = service as MlmodelService;

        return (
          <>
            <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
              <label className="tw-mb-0">Registry:</label>
              <span
                className=" tw-ml-1 tw-font-normal tw-text-grey-body"
                data-testid="pipeline-url">
                {mlmodel.connection?.config?.registryUri || '--'}
              </span>
            </div>
            <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
              <label className="tw-mb-0">Tracking:</label>
              <span
                className=" tw-ml-1 tw-font-normal tw-text-grey-body"
                data-testid="pipeline-url">
                {mlmodel.connection?.config?.trackingUri || '--'}
              </span>
            </div>
          </>
        );
      }
      default: {
        return <></>;
      }
    }
  };

  return (
    <div className="tw-py-1" data-testid="services-container">
      {serviceData.length ? (
        <Fragment>
          <div className="tw-flex tw-justify-between" data-testid="header">
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
                onClick={goToAddService}>
                Add New Service
              </Button>
            </NonAdminAction>
          </div>
          <div
            className="tw-grid xl:tw-grid-cols-4 tw-grid-cols-2 tw-gap-4 tw-mb-4"
            data-testid="data-container">
            {serviceData.map((service, index) => (
              <Card key={index} style={leftPanelAntCardStyle}>
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
                              service as unknown as EntityReference
                            )}`}
                            title={getEntityName(
                              service as unknown as EntityReference
                            )}>
                            {getEntityName(
                              service as unknown as EntityReference
                            )}
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
                      {getOptionalFields(service)}
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
            ))}
          </div>
          {!isNil(paging.after) ||
            (!isNil(paging.before) && (
              <NextPrevious
                currentPage={currentPage}
                pageSize={PAGE_SIZE}
                paging={paging}
                pagingHandler={onPageChange}
                totalCount={paging.total}
              />
            ))}
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
                  onClick={goToAddService}>
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
