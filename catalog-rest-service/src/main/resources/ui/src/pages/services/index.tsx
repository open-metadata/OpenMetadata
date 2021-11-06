/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import { AxiosError, AxiosResponse } from 'axios';
import classNames from 'classnames';
import { isNull, lowerCase } from 'lodash';
import { ServiceCollection, ServiceData, ServiceTypes } from 'Models';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteService,
  getServiceDetails,
  getServices,
  postService,
  updateService,
} from '../../axiosAPIs/serviceAPI';
import { Button } from '../../components/buttons/Button/Button';
import NonAdminAction from '../../components/common/non-admin-action/NonAdminAction';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import Searchbar from '../../components/common/searchbar/Searchbar';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import {
  AddServiceModal,
  DataObj,
  EditObj,
  ServiceDataObj,
} from '../../components/Modals/AddServiceModal/AddServiceModal';
import ConfirmationModal from '../../components/Modals/ConfirmationModal/ConfirmationModal';
import {
  getServiceDetailsPath,
  TITLE_FOR_NON_ADMIN_ACTION,
} from '../../constants/constants';
import {
  arrServiceTypes,
  NoDataFoundPlaceHolder,
  servicesDisplayName,
} from '../../constants/services.const';
import { ServiceCategory } from '../../enums/service.enum';
import {
  DashboardService,
  DashboardServiceType,
} from '../../generated/entity/services/dashboardService';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { MessagingService } from '../../generated/entity/services/messagingService';
import { PipelineService } from '../../generated/entity/services/pipelineService';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import { getCountBadge, getTabClasses } from '../../utils/CommonUtils';
import { getFrequencyTime, serviceTypeLogo } from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';

type ServiceRecord = {
  databaseServices: Array<DatabaseService>;
  messagingServices: Array<MessagingService>;
  dashboardServices: Array<DashboardService>;
  pipelineServices: Array<PipelineService>;
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
  const { isAdminUser, isAuthDisabled } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [deleteSelection, setDeleteSelection] = useState({
    id: '',
    name: '',
  });
  const [serviceName, setServiceName] =
    useState<ServiceTypes>('databaseServices');
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
  const [servicesCount, setServicesCount] = useState({
    databaseServices: 0,
    messagingServices: 0,
    dashboardServices: 0,
    pipelineServices: 0,
  });

  const updateServiceList = (
    allServiceCollectionArr: Array<ServiceCollection>
  ) => {
    // fetch services of all individual collection
    if (allServiceCollectionArr.length) {
      let promiseArr = [];
      promiseArr = allServiceCollectionArr.map((obj) => {
        return getServices(obj.value);
      });
      Promise.allSettled(promiseArr).then(
        (result: PromiseSettledResult<AxiosResponse>[]) => {
          if (result.length) {
            let serviceArr = [];
            const serviceRecord = {} as ServiceRecord;
            serviceArr = result.map((service) =>
              service.status === 'fulfilled' ? service.value?.data?.data : []
            );
            for (let i = 0; i < serviceArr.length; i++) {
              serviceRecord[allServiceCollectionArr[i].value as ServiceTypes] =
                serviceArr[i];
            }
            setServices(serviceRecord);
            setServicesCount({
              databaseServices: serviceRecord.databaseServices.length,
              messagingServices: serviceRecord.messagingServices.length,
              dashboardServices: serviceRecord.dashboardServices.length,
              pipelineServices: serviceRecord.pipelineServices.length,
            });
            setServiceList(
              serviceRecord[serviceName] as unknown as Array<ServiceDataObj>
            );
          }
          setIsLoading(false);
        }
      );
    }
  };
  const handleSearchAction = (searchValue: string) => {
    setSearchText(searchValue);
    const curServ = services[serviceName];
    const updatedResult = (curServ as unknown as Array<ServiceDataObj>).filter(
      (serv) =>
        lowerCase(serv.description)?.includes(lowerCase(searchValue)) ||
        lowerCase(serv.name)?.includes(lowerCase(searchValue))
    );
    setServiceList(updatedResult);
    setServicesCount({ ...servicesCount, [serviceName]: updatedResult.length });
  };
  const handleAddService = () => {
    setEditData(undefined);
    setIsModalOpen(true);
  };
  const handleClose = () => {
    setIsModalOpen(false);
    setEditData(undefined);
  };

  const handleEdit = (value: ServiceDataObj) => {
    setEditData(value);
    setIsModalOpen(true);
  };

  const handleUpdate = (
    selectedService: string,
    id: string,
    dataObj: DataObj
  ) => {
    return new Promise<void>((resolve, reject) => {
      updateService(selectedService, id, dataObj)
        .then(({ data }: { data: AxiosResponse['data'] }) => {
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
        })
        .catch((err: AxiosError) => {
          reject(err);
        });
    });
  };

  const handleAdd = (selectedService: string, dataObj: DataObj) => {
    return new Promise<void>((resolve, reject) => {
      postService(selectedService, dataObj)
        .then(({ data }: { data: AxiosResponse['data'] }) => {
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
          resolve();
        })
        .catch((err: AxiosError) => {
          reject(err);
        });
    });
  };

  const handleSave = (
    dataObj: DataObj,
    selectedService: string,
    isEdit: EditObj
  ) => {
    let promiseSave;
    if (isEdit.edit && isEdit.id) {
      promiseSave = handleUpdate(selectedService, isEdit.id, dataObj);
    } else {
      promiseSave = handleAdd(selectedService, dataObj);
    }
    promiseSave
      .then(() => {
        setIsModalOpen(false);
        setEditData(undefined);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Something went wrong!',
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
    deleteService(serviceName, id).then((res: AxiosResponse) => {
      if (res.statusText === 'OK') {
        const updatedServiceList = serviceList.filter((s) => s.id !== id);
        setServices({ ...services, [serviceName]: updatedServiceList });
        setServicesCount((pre) => ({
          ...servicesCount,
          [serviceName]: pre[serviceName] - 1,
        }));
        setServiceList(updatedServiceList);
      }
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

  const getServiceLogo = (serviceType: string): JSX.Element | null => {
    const logo = serviceTypeLogo(serviceType);
    if (!isNull(logo)) {
      return <img alt="" className="tw-h-8 tw-w-8" src={logo} />;
    }

    return null;
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
    setServicesCount({
      ...servicesCount,
      [serviceName]: services[serviceName].length,
    });
    setServiceName(tabName);
    setServiceList(services[tabName] as unknown as Array<ServiceDataObj>);
  };

  const getOptionalFields = (service: ServiceDataObj): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        const databaseService = service as unknown as DatabaseService;

        return (
          <>
            <div className="tw-mb-1" data-testid="additional-field">
              <label className="tw-mb-0">Driver Class:</label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {databaseService.jdbc.driverClass}
              </span>
            </div>
          </>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        const messagingService = service as unknown as MessagingService;

        return (
          <>
            <div className="tw-mb-1" data-testid="additional-field">
              <label className="tw-mb-0">Brokers:</label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {messagingService.brokers.join(', ')}
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
                  : 'Dashboard URL:'}
              </label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {dashboardService.dashboardUrl}
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
              <label className="tw-mb-0">Pipeline URL:</label>
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

  useEffect(() => {
    //   fetch all service collection
    setIsLoading(true);
    getServiceDetails().then((res: AxiosResponse) => {
      let allServiceCollectionArr: Array<ServiceCollection> = [];
      if (res.data.data?.length) {
        allServiceCollectionArr = res.data.data.map((service: ServiceData) => {
          return {
            name: service.collection.name,
            value: service.collection.name,
          };
        });
        // Removed "setIsLoading(false)" from here,
        // If there are service categories available
        // Loader should wait for each category to fetch list of services
        // Then only it should stop Loading and show available data or No data template
        // This is handled in "updateServiceList" method
      } else {
        setIsLoading(false);
      }
      updateServiceList(allServiceCollectionArr);
    });
  }, []);

  return (
    <>
      {!isLoading ? (
        <PageContainer>
          <div className="container-fluid" data-testid="services-container">
            <div className="tw-bg-transparent tw-mb-4">
              <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
                {getServiceTabs().map((tab, index) => (
                  <button
                    className={getTabClasses(tab.name, serviceName)}
                    data-testid="tab"
                    key={index}
                    onClick={() => handleTabChange(tab.name)}>
                    {tab.displayName}
                    {getCountBadge(servicesCount[tab.name])}
                  </button>
                ))}
              </nav>
            </div>
            <div className="tw-flex">
              <div className="tw-w-4/12">
                {searchText || serviceList.length > 0 ? (
                  <Searchbar
                    placeholder={`Search for ${servicesDisplayName[serviceName]}...`}
                    searchValue={searchText}
                    typingInterval={100}
                    onSearch={handleSearchAction}
                  />
                ) : null}
              </div>
              <div className="tw-w-8/12 tw-flex tw-justify-end">
                {serviceList.length > 0 ? (
                  <NonAdminAction
                    position="bottom"
                    title={TITLE_FOR_NON_ADMIN_ACTION}>
                    <Button
                      className={classNames('tw-h-8 tw-rounded tw-mb-2', {
                        'tw-opacity-40': !isAdminUser && !isAuthDisabled,
                      })}
                      data-testid="add-new-user-button"
                      size="small"
                      theme="primary"
                      variant="contained"
                      onClick={() => handleAddService()}>
                      Add New Service
                    </Button>
                  </NonAdminAction>
                ) : null}
              </div>
            </div>
            {serviceList.length ? (
              <div
                className="tw-grid tw-grid-cols-4 tw-gap-4"
                data-testid="data-container">
                {serviceList.map((service, index) => (
                  <div
                    className="tw-card tw-flex tw-py-2 tw-px-3 tw-justify-between tw-text-grey-muted"
                    key={index}>
                    <div className="tw-flex-auto">
                      <Link
                        to={getServiceDetailsPath(
                          service.name,
                          service.serviceType || ''
                        )}>
                        <button>
                          <h6
                            className="tw-text-base tw-text-grey-body tw-font-medium"
                            data-testid="service-name">
                            {service.name}
                          </h6>
                        </button>
                      </Link>
                      <div
                        className="tw-text-grey-body tw-pb-1 tw-break-all description-text"
                        data-testid="service-description">
                        {service.description ? (
                          <RichTextEditorPreviewer
                            markdown={service.description}
                          />
                        ) : (
                          <span className="tw-no-description">
                            No description added
                          </span>
                        )}
                      </div>
                      {getOptionalFields(service)}
                      <div className="tw-mb-1" data-testid="service-ingestion">
                        <label className="tw-mb-0">Ingestion:</label>
                        <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                          {service.ingestionSchedule?.repeatFrequency
                            ? getFrequencyTime(
                                service.ingestionSchedule.repeatFrequency
                              )
                            : '--'}
                        </span>
                      </div>
                      <div className="" data-testid="service-type">
                        <label className="tw-mb-0">Type:</label>
                        <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                          {service.serviceType}
                        </span>
                      </div>
                    </div>
                    <div className="tw-flex tw-flex-col tw-justify-between tw-flex-none">
                      <div className="tw-flex tw-justify-end">
                        <NonAdminAction
                          position="top"
                          title={TITLE_FOR_NON_ADMIN_ACTION}>
                          <button
                            className="tw-pr-3 focus:tw-outline-none"
                            data-testid="edit-service"
                            onClick={() => handleEdit(service)}>
                            <SVGIcons
                              alt="edit"
                              icon="icon-edit"
                              title="Edit"
                              width="12px"
                            />
                          </button>
                        </NonAdminAction>
                        <NonAdminAction
                          position="top"
                          title={TITLE_FOR_NON_ADMIN_ACTION}>
                          <button
                            className="focus:tw-outline-none"
                            data-testid="delete-service"
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
                        {/* {!isNull(serviceTypeLogo(service.serviceType)) && (
                          <img
                            alt=""
                            className="tw-h-10 tw-w-10"
                            src={serviceTypeLogo(service.serviceType)}
                          />
                        )} */}
                        {getServiceLogo(service.serviceType || '')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="tw-flex tw-items-center tw-flex-col">
                <div className="tw-mt-24">
                  <img
                    alt="No Service"
                    src={NoDataFoundPlaceHolder}
                    width={250}
                  />
                </div>
                <div className="tw-mt-11">
                  <p className="tw-text-lg tw-text-center">
                    {`No services found ${
                      searchText ? `for "${searchText}"` : ''
                    }`}
                  </p>
                  <p className="tw-text-lg tw-text-center">
                    <button
                      className="link-text tw-underline"
                      data-testid="add-service-button"
                      onClick={handleAddService}>
                      Click here
                    </button>{' '}
                    to add new {servicesDisplayName[serviceName]}
                  </p>
                </div>
              </div>
            )}

            {isModalOpen && (
              <AddServiceModal
                data={editData}
                header={`${editData ? 'Edit' : 'Add new'} service`}
                serviceList={serviceList}
                serviceName={serviceName}
                onCancel={handleClose}
                onSave={handleSave}
              />
            )}

            {isConfirmationModalOpen && (
              <ConfirmationModal
                bodyText={`You want to delete service ${deleteSelection.name} permanently? This action cannot be reverted.`}
                cancelText="Discard"
                confirmButtonCss="tw-bg-error hover:tw-bg-error focus:tw-bg-error"
                confirmText="Delete"
                header="Are you sure?"
                onCancel={handleCancelConfirmationModal}
                onConfirm={() => handleDelete(deleteSelection.id)}
              />
            )}
          </div>
        </PageContainer>
      ) : (
        <Loader />
      )}
    </>
  );
};

export default ServicesPage;
