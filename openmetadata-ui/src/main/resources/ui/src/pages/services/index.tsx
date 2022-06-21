/*
 *  Copyright 2021 Collate
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
import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isNil } from 'lodash';
import { ServiceCollection, ServiceData, ServiceTypes } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import { useAuthContext } from '../../authentication/auth-provider/AuthProvider';
import { getServiceDetails, getServices } from '../../axiosAPIs/serviceAPI';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout, {
  leftPanelAntCardStyle,
} from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import {
  getServiceDetailsPath,
  PAGE_SIZE,
  pagingObject,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import {
  arrServiceTypes,
  NoDataFoundPlaceHolder,
  servicesDisplayName,
} from '../../constants/services.const';
import { ServiceCategory } from '../../enums/service.enum';
import { DashboardService } from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import { EntityReference } from '../../generated/type/entityReference';
import { Paging } from '../../generated/type/paging';
import { useAuth } from '../../hooks/authHooks';
import { ServiceDataObj } from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import {
  getActiveCatClass,
  getCountBadge,
  getEntityName,
  getServiceLogo,
} from '../../utils/CommonUtils';
import { getDashboardURL } from '../../utils/DashboardServiceUtils';
import { getBrokers } from '../../utils/MessagingServiceUtils';
import {
  getAddServicePath,
  getServicesWithTabPath,
} from '../../utils/RouterUtils';
import { getErrorText } from '../../utils/StringsUtils';
import { showErrorToast } from '../../utils/ToastUtils';

type ServiceRecord = {
  databaseServices: Array<DatabaseService>;
  messagingServices: Array<MessagingService>;
  dashboardServices: Array<DashboardService>;
  pipelineServices: Array<PipelineService>;
};

type ServicePagingRecord = {
  databaseServices: Paging;
  messagingServices: Paging;
  dashboardServices: Paging;
  pipelineServices: Paging;
};

export type ApiData = {
  description: string;
  href: string;
  id: string;
  jdbc: { driverClass: string; connectionUrl: string };
  name: string;
  serviceType: string;
  ingestionSchedule?: { repeatFrequency: string; startDate: string };
};

const ServicesPage = () => {
  const { serviceCategory } = useParams<{ [key: string]: string }>();
  const history = useHistory();

  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [serviceName, setServiceName] = useState<ServiceTypes>(
    (serviceCategory as ServiceTypes) ?? 'databaseServices'
  );
  const [paging, setPaging] = useState<ServicePagingRecord>({
    databaseServices: pagingObject,
    messagingServices: pagingObject,
    dashboardServices: pagingObject,
    pipelineServices: pagingObject,
  });
  const [services, setServices] = useState<ServiceRecord>({
    databaseServices: [],
    messagingServices: [],
    dashboardServices: [],
    pipelineServices: [],
  });
  const [serviceList, setServiceList] = useState<Array<ServiceDataObj>>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [servicesCount, setServicesCount] = useState({
    databaseServices: 0,
    messagingServices: 0,
    dashboardServices: 0,
    pipelineServices: 0,
  });

  const [currentPage, setCurrentPage] = useState(1);

  const updateServiceList = (
    allServiceCollectionArr: Array<ServiceCollection>
  ) => {
    // fetch services of all individual collection
    if (allServiceCollectionArr.length) {
      let promiseArr = [];
      promiseArr = allServiceCollectionArr.map((obj) => {
        return getServices(obj.value);
      });
      Promise.allSettled(promiseArr)
        .then((result: PromiseSettledResult<AxiosResponse>[]) => {
          if (result.length) {
            let serviceArr = [];
            let servicePagingArr = [];
            const errors: Array<AxiosError> = [];
            let unexpectedResponses = 0;
            const serviceRecord = {} as ServiceRecord;
            const servicePaging = {} as ServicePagingRecord;
            serviceArr = result.map((service) => {
              let data = [];
              if (service.status === 'fulfilled') {
                data = service.value?.data?.data;
              } else {
                errors.push(service.reason);
              }

              return data;
            });
            servicePagingArr = result.map((service) =>
              service.status === 'fulfilled' ? service.value?.data?.paging : {}
            );
            for (let i = 0; i < serviceArr.length; i++) {
              serviceRecord[allServiceCollectionArr[i].value as ServiceTypes] =
                serviceArr[i];
              servicePaging[allServiceCollectionArr[i].value as ServiceTypes] =
                servicePagingArr[i];
            }
            setServices(serviceRecord);

            setPaging(servicePaging);
            setServicesCount({
              databaseServices: servicePaging.databaseServices.total || 0,
              messagingServices: servicePaging.messagingServices.total || 0,
              dashboardServices: servicePaging.dashboardServices.total || 0,
              pipelineServices: servicePaging.pipelineServices.total || 0,
            });
            setServiceList(
              serviceRecord[serviceName] as unknown as Array<ServiceDataObj>
            );
            if (errors.length) {
              for (const err of errors) {
                const errMsg = getErrorText(err, '');
                if (errMsg) {
                  showErrorToast(errMsg);
                } else {
                  unexpectedResponses++;
                }
              }
              if (unexpectedResponses > 0) {
                showErrorToast(
                  jsonData['api-error-messages']['unexpected-server-response']
                );
              }
            }
          }
          setIsLoading(false);
        })
        .catch((err: AxiosError) => {
          showErrorToast(
            err,
            jsonData['api-error-messages']['fetch-services-error']
          );
        });
    }
  };

  const goToAddService = () => {
    history.push(getAddServicePath(serviceName));
  };

  const handleAddService = () => {
    goToAddService();
  };

  const getServiceTabs = (): Array<{
    name: ServiceTypes;
    displayName: string;
  }> => {
    const tabs = Object.keys(services);

    return arrServiceTypes
      .filter((item) => tabs.includes(item))
      .map((type) => {
        return {
          name: type,
          displayName: servicesDisplayName[type],
        };
      });
  };

  const handleTabChange = (tabName: ServiceTypes) => {
    setSearchText('');
    setServiceName(tabName);
    history.push(getServicesWithTabPath(tabName));
    setServiceList(services[tabName] as unknown as Array<ServiceDataObj>);
  };

  const fetchLeftPanel = () => {
    return (
      <Card
        data-testid="data-summary-container"
        style={leftPanelAntCardStyle}
        title={
          <div className="tw-flex tw-justify-between tw-items-center">
            <h6 className="tw-heading tw-text-base">Services</h6>
          </div>
        }>
        <>
          {getServiceTabs()?.map((tab, index) => {
            return (
              <div
                className={`tw-group tw-text-grey-body tw-cursor-pointer tw-text-body tw-mb-3 tw-flex tw-justify-between ${getActiveCatClass(
                  tab.name,
                  serviceName
                )}`}
                data-testid="tab"
                key={index}
                onClick={() => {
                  handleTabChange(tab.name);
                }}>
                <p className="tw-text-center tw-self-center label-category">
                  {tab.displayName}
                </p>

                {getCountBadge(
                  servicesCount[tab.name],
                  'tw-self-center',
                  tab.name === serviceName
                )}
              </div>
            );
          })}
        </>
      </Card>
    );
  };

  const getOptionalFields = (service: ServiceDataObj): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.MESSAGING_SERVICES: {
        const messagingService = service as unknown as MessagingService;

        return (
          <>
            <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
              <label className="tw-mb-0">Brokers:</label>
              <span
                className=" tw-ml-1 tw-font-normal tw-text-grey-body"
                data-testid="brokers">
                {getBrokers(messagingService.connection?.config)}
              </span>
            </div>
          </>
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        const dashboardService = service as unknown as DashboardService;

        return (
          <>
            <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
              <label className="tw-mb-0">URL:</label>
              <span
                className=" tw-ml-1 tw-font-normal tw-text-grey-body"
                data-testid="dashboard-url">
                {getDashboardURL(dashboardService.connection.config)}
              </span>
            </div>
          </>
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        const pipelineService = service as unknown as PipelineService;

        return (
          <>
            <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
              <label className="tw-mb-0">URL:</label>
              <span
                className=" tw-ml-1 tw-font-normal tw-text-grey-body"
                data-testid="pipeline-url">
                {pipelineService.connection.config?.hostPort}
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

  const pagingHandler = (cursorType: string | number, activePage?: number) => {
    setIsLoading(true);
    const currentServicePaging = paging[serviceName];
    const pagingString = `${serviceName}?${cursorType}=${
      currentServicePaging[cursorType as keyof Paging]
    }`;
    getServices(pagingString)
      .then((result: AxiosResponse) => {
        if (result.data) {
          const currentServices = result.data.data;
          setServiceList(currentServices);

          setServices({
            ...services,
            [serviceName]: currentServices,
          });

          setPaging({
            ...paging,
            [serviceName]: result.data.paging,
          });
          setCurrentPage(activePage ?? 0);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError | string) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-services-error']
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const getPagination = () => {
    return !isNil(paging[serviceName].after) ||
      !isNil(paging[serviceName].before) ? (
      <NextPrevious
        currentPage={currentPage}
        pageSize={PAGE_SIZE}
        paging={paging[serviceName]}
        pagingHandler={pagingHandler}
        totalCount={paging[serviceName].total}
      />
    ) : null;
  };

  const noServicesText = (strSearch: string) => {
    let text = 'No services found';
    if (strSearch) {
      text = `${text} for ${strSearch}`;
    }

    return text;
  };

  const getServiceList = () => {
    return serviceList.length ? (
      <Fragment>
        <div className="tw-flex tw-justify-between" data-testid="header">
          <div
            className="tw-heading tw-text-link tw-text-base"
            data-testid="service-name">
            {servicesDisplayName[serviceName]}
          </div>
          <NonAdminAction position="bottom" title={TITLE_FOR_NON_ADMIN_ACTION}>
            <Button
              className={classNames('tw-h-8 tw-rounded tw-mb-2', {
                'tw-opacity-40': !isAdminUser && !isAuthDisabled,
              })}
              data-testid="add-new-service-button"
              size="small"
              theme="primary"
              variant="contained"
              onClick={() => handleAddService()}>
              Add New Service
            </Button>
          </NonAdminAction>
        </div>
        <div
          className="tw-grid xl:tw-grid-cols-4 tw-grid-cols-2 tw-gap-4 tw-mb-4"
          data-testid="data-container">
          {serviceList.map((service, index) => (
            <Card key={index} style={leftPanelAntCardStyle}>
              <div
                className="tw-flex tw-py-2 tw-px-3 tw-justify-between tw-text-grey-muted"
                data-testid="service-card">
                <div className="tw-flex tw-flex-col tw-justify-between tw-truncate">
                  <div>
                    <Link to={getServiceDetailsPath(service.name, serviceName)}>
                      <button>
                        <h6
                          className="tw-text-base tw-text-grey-body tw-font-medium tw-text-left tw-truncate tw-w-48"
                          data-testid={`service-name-${getEntityName(
                            service as EntityReference
                          )}`}
                          title={getEntityName(service as EntityReference)}>
                          {getEntityName(service as EntityReference)}
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
      </Fragment>
    ) : (
      <div className="tw-flex tw-items-center tw-flex-col">
        <div className="tw-mt-24">
          <img alt="No Service" src={NoDataFoundPlaceHolder} width={250} />
        </div>
        <div className="tw-mt-11">
          <p className="tw-text-lg tw-text-center">
            {noServicesText(searchText)}
          </p>
          <p className="tw-text-lg tw-text-center">
            <NonAdminAction
              position="bottom"
              title={TITLE_FOR_NON_ADMIN_ACTION}>
              <Button
                data-testid="add-service-button"
                size="small"
                theme="primary"
                variant="outlined"
                onClick={handleAddService}>
                Click here
              </Button>
            </NonAdminAction>{' '}
            to add new {servicesDisplayName[serviceName]}
          </p>
        </div>
      </div>
    );
  };

  const getPageLayout = () => {
    return errorMessage ? (
      <ErrorPlaceHolder>{errorMessage}</ErrorPlaceHolder>
    ) : (
      <PageLayout leftPanel={fetchLeftPanel()}>
        <div data-testid="services-container" style={{ padding: '14px' }}>
          {getServiceList()}

          {getPagination()}
        </div>
      </PageLayout>
    );
  };

  useEffect(() => {
    //   fetch all service collection
    setIsLoading(true);
    getServiceDetails()
      .then((res: AxiosResponse) => {
        if (res.data) {
          let allServiceCollectionArr: Array<ServiceCollection> = [];
          if (res.data.data?.length) {
            allServiceCollectionArr = res.data.data.reduce(
              (prev: Array<ServiceCollection>, curr: ServiceData) => {
                const sName = curr.collection.name as ServiceTypes;

                return arrServiceTypes.includes(sName)
                  ? [
                      ...prev,
                      {
                        name: sName,
                        value: sName,
                      },
                    ]
                  : prev;
              },
              []
            );
            // Removed "setIsLoading(false)" from here,
            // If there are service categories available
            // Loader should wait for each category to fetch list of services
            // Then only it should stop Loading and show available data or No data template
            // This is handled in "updateServiceList" method
          } else {
            setIsLoading(false);
          }
          updateServiceList(allServiceCollectionArr);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError | string) => {
        showErrorToast(
          err,
          jsonData['api-error-messages']['fetch-services-error']
        );
        setIsLoading(false);
        setErrorMessage(jsonData['message']['no-services']);
      });
  }, []);

  return (
    <Fragment>
      {!isLoading ? (
        <PageContainerV1 className="tw-pt-4">{getPageLayout()}</PageContainerV1>
      ) : (
        <Loader />
      )}
    </Fragment>
  );
};

export default ServicesPage;
