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

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isNil } from 'lodash';
import { Paging, ServiceCollection, ServiceData, ServiceTypes } from 'Models';
import React, { Fragment, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import { addAirflowPipeline } from '../../axiosAPIs/airflowPipelineAPI';
import {
  deleteService,
  getServiceDetails,
  getServices,
  postService,
  updateService,
} from '../../axiosAPIs/serviceAPI';
import { Button } from '../../components/buttons/Button/Button';
import ErrorPlaceHolder from '../../components/common/error-with-placeholder/ErrorPlaceHolder';
import NextPrevious from '../../components/common/next-previous/NextPrevious';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import PageLayout from '../../components/containers/PageLayout';
import Loader from '../../components/Loader/Loader';
import { AddServiceModal } from '../../components/Modals/AddServiceModal/AddServiceModal';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import {
  getServiceDetailsPath,
  pagingObject,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import {
  arrServiceTypes,
  NoDataFoundPlaceHolder,
  servicesDisplayName,
} from '../../constants/services.const';
import { ServiceCategory } from '../../enums/service.enum';
import { CreateAirflowPipeline } from '../../generated/api/operations/pipelines/createAirflowPipeline';
import {
  DashboardService,
  DashboardServiceType,
} from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import { PipelineType } from '../../generated/operations/pipelines/airflowPipeline';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import {
  DataObj,
  EditObj,
  ServiceDataObj,
} from '../../interface/service.interface';
import jsonData from '../../jsons/en';
import {
  getActiveCatClass,
  getCountBadge,
  getServiceLogo,
} from '../../utils/CommonUtils';
import { getErrorText } from '../../utils/StringsUtils';
import SVGIcons from '../../utils/SvgUtils';

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
  const showToast = useToastContext();
  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState({
    id: '',
    name: '',
  });
  const [serviceName, setServiceName] =
    useState<ServiceTypes>('databaseServices');
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
  const [editData, setEditData] = useState<ServiceDataObj>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [searchText, setSearchText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [servicesCount, setServicesCount] = useState({
    databaseServices: 0,
    messagingServices: 0,
    dashboardServices: 0,
    pipelineServices: 0,
  });

  const handleShowErrorToast = (errMessage: string) => {
    showToast({
      variant: 'error',
      body: errMessage,
    });
  };

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
                  handleShowErrorToast(errMsg);
                } else {
                  unexpectedResponses++;
                }
              }
              if (unexpectedResponses > 0) {
                handleShowErrorToast(
                  jsonData['api-error-messages']['unexpected-server-response']
                );
              }
            }
          }
          setIsLoading(false);
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['fetch-services-error']
          );
          handleShowErrorToast(errMsg);
        });
    }
  };

  const handleAddService = () => {
    setEditData(undefined);
    setIsModalOpen(true);
  };
  const handleClose = () => {
    setIsModalOpen(false);
    setEditData(undefined);
  };

  const handleUpdate = (
    selectedService: string,
    id: string,
    dataObj: DataObj
  ) => {
    return new Promise<void>((resolve, reject) => {
      updateService(selectedService, id, dataObj)
        .then(({ data }: { data: AxiosResponse['data'] }) => {
          if (data) {
            const updatedData = {
              ...data,
              ...data.jdbc,
              ...data.brokers,
              ...data.schemaRegistry,
            };
            const updatedServiceList = serviceList.map((s) =>
              s.id === updatedData.id ? updatedData : s
            );
            setServices({ ...services, [serviceName]: updatedServiceList });
            setServiceList(updatedServiceList);
            resolve();
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          reject(err);
        });
    });
  };

  const handleAdd = (selectedService: string, dataObj: DataObj) => {
    return new Promise<AxiosResponse>((resolve, reject) => {
      postService(selectedService, dataObj)
        .then((res: AxiosResponse) => {
          const { data } = res;
          if (data) {
            const updatedData = {
              ...data,
              ...data.jdbc,
              ...data.brokers,
              ...data.schemaRegistry,
            };
            const updatedServiceList = [...serviceList, updatedData];
            setServices({ ...services, [serviceName]: updatedServiceList });
            setServicesCount((pre) => ({
              ...servicesCount,
              [serviceName]: pre[serviceName] + 1,
            }));
            setServiceList(updatedServiceList);
            resolve(res);
          } else {
            throw jsonData['api-error-messages']['unexpected-server-response'];
          }
        })
        .catch((err: AxiosError) => {
          reject(err);
        });
    });
  };

  const handleServicePromises = (
    serviceId: string,
    ingestionList?: CreateAirflowPipeline[]
  ) => {
    if (ingestionList?.length && serviceId) {
      const promises = ingestionList.map((ingestion) => {
        return addAirflowPipeline({
          ...ingestion,
          service: {
            ...ingestion.service,
            id: serviceId,
          },
          pipelineType: PipelineType.Metadata,
        });
      });

      Promise.allSettled(promises)
        .then((response: PromiseSettledResult<AxiosResponse>[]) => {
          setIsModalOpen(false);
          setEditData(undefined);
          response.map((data) => {
            if (data.status === 'rejected') {
              throw data.reason;
            }
          });
        })
        .catch((err: AxiosError) => {
          const errMsg = getErrorText(
            err,
            jsonData['api-error-messages']['add-ingestion-error']
          );
          showToast({
            variant: 'error',
            body: errMsg,
          });
        });
    } else {
      setIsModalOpen(false);
      setEditData(undefined);
    }
  };

  const handleServiceSavePromise = (
    serviceRes: AxiosResponse | void,
    ingestionList?: CreateAirflowPipeline[]
  ) => {
    if (serviceRes?.data) {
      const serviceId = serviceRes?.data.id;
      handleServicePromises(serviceId, ingestionList);
    } else {
      throw jsonData['api-error-messages']['unexpected-server-response'];
    }
  };

  const handleSave = (
    dataObj: DataObj,
    selectedService: string,
    isEdit: EditObj,
    ingestionList?: CreateAirflowPipeline[]
  ) => {
    let promiseSave;
    if (isEdit.edit && isEdit.id) {
      promiseSave = handleUpdate(selectedService, isEdit.id, dataObj);
    } else {
      promiseSave = handleAdd(selectedService, dataObj);
    }
    promiseSave
      .then((serviceRes: AxiosResponse | void) => {
        handleServiceSavePromise(serviceRes, ingestionList);
      })
      .catch((err: AxiosError | string) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['add-service-error']
        );
        showToast({
          variant: 'error',
          body: errMsg,
        });
      });
  };

  const handleCancelConfirmationModal = () => {
    setIsConfirmationModalOpen(false);
    setDeleteSelection({
      id: '',
      name: '',
    });
  };

  const handleDelete = (id: string) => {
    deleteService(serviceName, id)
      .then((res: AxiosResponse) => {
        if (res.statusText === 'OK') {
          const updatedServiceList = serviceList.filter((s) => s.id !== id);
          setServices({ ...services, [serviceName]: updatedServiceList });
          setServicesCount((pre) => ({
            ...servicesCount,
            [serviceName]: pre[serviceName] - 1,
          }));
          setServiceList(updatedServiceList);
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError) => {
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['delete-service-error']
        );
        handleShowErrorToast(errMsg);
      });

    handleCancelConfirmationModal();
  };

  const ConfirmDelete = (id: string, name: string) => {
    setDeleteSelection({
      id,
      name,
    });
    setIsConfirmationModalOpen(true);
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
    setServiceList(services[tabName] as unknown as Array<ServiceDataObj>);
  };

  const fetchLeftPanel = () => {
    return (
      <>
        <div className="tw-flex tw-justify-between tw-items-center tw-mb-3 tw-border-b">
          <h6 className="tw-heading tw-text-base">Services</h6>
        </div>

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
    );
  };

  const getOptionalFields = (service: ServiceDataObj): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.MESSAGING_SERVICES: {
        const messagingService = service as unknown as MessagingService;

        return (
          <>
            <div className="tw-mb-1" data-testid="additional-field">
              <label className="tw-mb-0">Brokers:</label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {messagingService.connection.config?.bootstrapServers}
              </span>
            </div>
          </>
        );
      }
      case ServiceCategory.DASHBOARD_SERVICES: {
        const dashboardService = service as unknown as DashboardService;

        return (
          <>
            <div className="tw-mb-1" data-testid="additional-field">
              <label className="tw-mb-0">
                {dashboardService.serviceType === DashboardServiceType.Tableau
                  ? 'Site URL:'
                  : 'URL:'}
              </label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {dashboardService.connection.config?.url}
              </span>
            </div>
          </>
        );
      }
      case ServiceCategory.PIPELINE_SERVICES: {
        const pipelineService = service as unknown as PipelineService;

        return (
          <>
            <div className="tw-mb-1" data-testid="additional-field">
              <label className="tw-mb-0">URL:</label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {pipelineService.pipelineUrl}
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

  const pagingHandler = (cursorType: string) => {
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
        } else {
          throw jsonData['api-error-messages']['unexpected-server-response'];
        }
      })
      .catch((err: AxiosError | string) => {
        const msg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-services-error']
        );
        handleShowErrorToast(msg);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const getConfirmationModal = () => {
    return isConfirmationModalOpen ? (
      <ConfirmationModal
        bodyText={`You want to delete service ${deleteSelection.name} permanently? This action cannot be reverted.`}
        cancelText="Discard"
        confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
        confirmText="Delete"
        header="Are you sure?"
        onCancel={handleCancelConfirmationModal}
        onConfirm={() => handleDelete(deleteSelection.id)}
      />
    ) : null;
  };

  const getAddServiceModal = () => {
    return isModalOpen ? (
      <AddServiceModal
        data={editData as DataObj}
        header={`${editData ? 'Edit' : 'Add new'} service`}
        serviceList={serviceList}
        serviceName={serviceName}
        onCancel={handleClose}
        onSave={handleSave}
      />
    ) : null;
  };

  const getPagination = () => {
    return !isNil(paging[serviceName].after) ||
      !isNil(paging[serviceName].before) ? (
      <NextPrevious
        paging={paging[serviceName]}
        pagingHandler={pagingHandler}
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
            <div
              className="tw-card tw-flex tw-py-2 tw-px-3 tw-justify-between tw-text-grey-muted"
              key={index}>
              <div className="tw-flex-auto tw-flex tw-flex-col tw-justify-between">
                <div>
                  <Link to={getServiceDetailsPath(service.name, serviceName)}>
                    <button>
                      <h6
                        className="tw-text-base tw-text-grey-body tw-font-medium tw-text-left tw-truncate tw-w-48"
                        data-testid={`service-name-${service.name}`}
                        title={service.name}>
                        {service.name}
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
                      <span className="tw-no-description">No description</span>
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
                  data-testid="delete-icon-container">
                  <NonAdminAction
                    position="top"
                    title={TITLE_FOR_NON_ADMIN_ACTION}>
                    <button
                      className="focus:tw-outline-none"
                      data-testid={`delete-service-${service.name}`}
                      onClick={() =>
                        ConfirmDelete(service.id || '', service.name)
                      }>
                      <SVGIcons
                        alt="delete"
                        icon="icon-delete"
                        title="Delete"
                        width="12px"
                      />
                    </button>
                  </NonAdminAction>
                </div>
                <div
                  className="tw-flex tw-justify-end"
                  data-testid="service-icon">
                  {getServiceLogo(service.serviceType || '', 'tw-h-8 tw-w-8')}
                </div>
              </div>
            </div>
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
        <div data-testid="services-container">
          {getServiceList()}

          {getPagination()}

          {getAddServiceModal()}

          {getConfirmationModal()}
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
            allServiceCollectionArr = res.data.data.map(
              (service: ServiceData) => {
                return {
                  name: service.collection.name,
                  value: service.collection.name,
                };
              }
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
        const errMsg = getErrorText(
          err,
          jsonData['api-error-messages']['fetch-services-error']
        );
        setIsLoading(false);
        setErrorMessage(jsonData['message']['no-services']);
        handleShowErrorToast(errMsg);
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
