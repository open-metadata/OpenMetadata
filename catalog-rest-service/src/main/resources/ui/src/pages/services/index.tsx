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

import { AxiosResponse } from 'axios';
import { isNull } from 'lodash';
import {
  ServiceCollection,
  ServiceData,
  ServiceRecord,
  ServiceTypes,
} from 'Models';
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteService,
  getServiceDetails,
  getServices,
  postService,
  updateService,
} from '../../axiosAPIs/serviceAPI';
import RichTextEditorPreviewer from '../../components/common/rich-text-editor/RichTextEditorPreviewer';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import {
  AddServiceModal,
  DataObj,
  EditObj,
  ServiceDataObj,
} from '../../components/Modals/AddServiceModal/AddServiceModal';
import { getServiceDetailsPath } from '../../constants/constants';
import {
  arrServiceTypes,
  NOSERVICE,
  PLUS,
  servicesDisplayName,
} from '../../constants/services.const';
import { ServiceCategory } from '../../enums/service.enum';
import { getTabClasses } from '../../utils/CommonUtils';
import { getFrequencyTime, serviceTypeLogo } from '../../utils/ServiceUtils';
import SVGIcons from '../../utils/SvgUtils';

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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceName, setServiceName] =
    useState<ServiceTypes>('databaseServices');
  const [services, setServices] = useState<ServiceRecord>({
    databaseServices: [],
    messagingServices: [],
  });
  const [serviceList, setServiceList] = useState<Array<ServiceDataObj>>([]);
  const [editData, setEditData] = useState<ServiceDataObj>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const updateServiceList = (
    allServiceCollectionArr: Array<ServiceCollection>
  ) => {
    // let listArr = [];
    //   fetch services of all individual collection
    if (allServiceCollectionArr.length) {
      let promiseArr = [];
      promiseArr = allServiceCollectionArr.map((obj) => {
        return getServices(obj.value);
      });
      Promise.all(promiseArr).then((result: AxiosResponse[]) => {
        if (result.length) {
          let serviceArr = [];
          const serviceRecord = {} as ServiceRecord;
          serviceArr = result.map((service) => service?.data?.data || []);
          for (let i = 0; i < serviceArr.length; i++) {
            serviceRecord[allServiceCollectionArr[i].value as ServiceTypes] =
              serviceArr[i].map((s: ApiData) => {
                return { ...s, ...s.jdbc };
              });
          }
          // // converted array of arrays to array
          // const allServices = serviceArr.reduce(
          //   (acc, el) => acc.concat(el),
          //   []
          // );
          // listArr = allServices.map((s: ApiData) => {
          //   return { ...s, ...s.jdbc };
          // });
          setServices(serviceRecord);
          setServiceList(serviceRecord[serviceName]);
        }
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

  const handleEdit = (value: ServiceDataObj) => {
    setEditData(value);
    setIsModalOpen(true);
  };

  const handleUpdate = (
    selectedService: string,
    id: string,
    dataObj: DataObj
  ) => {
    updateService(selectedService, id, dataObj).then(
      ({ data }: { data: AxiosResponse['data'] }) => {
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
      }
    );
  };

  const handleAdd = (selectedService: string, dataObj: DataObj) => {
    postService(selectedService, dataObj).then(
      ({ data }: { data: AxiosResponse['data'] }) => {
        const updatedData = {
          ...data,
          ...data.jdbc,
          ...data.brokers,
          ...data.schemaRegistry,
        };
        const updatedServiceList = [...serviceList, updatedData];
        setServices({ ...services, [serviceName]: updatedServiceList });
        setServiceList(updatedServiceList);
      }
    );
  };

  const handleSave = (
    dataObj: DataObj,
    selectedService: string,
    isEdit: EditObj
  ) => {
    if (isEdit.edit) {
      isEdit.id && handleUpdate(selectedService, isEdit.id, dataObj);
    } else {
      handleAdd(selectedService, dataObj);
    }
    setIsModalOpen(false);
    setEditData(undefined);
  };

  const handleDelete = (id: string) => {
    deleteService(serviceName, id).then((res: AxiosResponse) => {
      if (res.statusText === 'OK') {
        const updatedServiceList = serviceList.filter((s) => s.id !== id);
        setServices({ ...services, [serviceName]: updatedServiceList });
        setServiceList(updatedServiceList);
      }
    });
  };

  const getServiceLogo = (serviceType: string): JSX.Element | null => {
    const logo = serviceTypeLogo(serviceType);
    if (!isNull(logo)) {
      return <img alt="" className="tw-h-10 tw-w-10" src={logo} />;
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

  const getOptionalFields = (service: ServiceDataObj): JSX.Element => {
    switch (serviceName) {
      case ServiceCategory.DATABASE_SERVICES: {
        return (
          <>
            <div className="tw-mb-1">
              <label className="tw-mb-0">Driver Class:</label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {service.driverClass}
              </span>
            </div>
          </>
        );
      }
      case ServiceCategory.MESSAGING_SERVICES: {
        return (
          <>
            <div className="tw-mb-1">
              <label className="tw-mb-0">Brokers:</label>
              <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                {service.brokers?.join(', ')}
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
        setIsLoading(false);
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
          <div className="container-fluid">
            <div className="tw-bg-transparent tw-mb-4">
              <nav className="tw-flex tw-flex-row tw-gh-tabs-container tw-px-4">
                {getServiceTabs().map((tab, index) => (
                  <button
                    className={getTabClasses(tab.name, serviceName)}
                    data-testid="tab"
                    key={index}
                    onClick={() => {
                      setServiceName(tab.name);
                      setServiceList(services[tab.name]);
                    }}>
                    {tab.displayName}
                  </button>
                ))}
              </nav>
            </div>
            {serviceList.length ? (
              <div className="tw-grid tw-grid-cols-4 tw-gap-4">
                {serviceList.map((service, index) => (
                  <div
                    className="tw-card tw-flex tw-py-2 tw-px-3 tw-justify-between tw-text-grey-muted"
                    key={index}>
                    <div className="tw-flex-auto">
                      <Link
                        to={getServiceDetailsPath(
                          service.name,
                          service.serviceType
                        )}>
                        <button>
                          <h6 className="tw-text-base tw-text-grey-body tw-font-medium">
                            {service.name}
                          </h6>
                        </button>
                      </Link>
                      <div className="tw-text-grey-body tw-pb-1">
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
                      <div className="tw-mb-1">
                        <label className="tw-mb-0">Ingestion:</label>
                        <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                          {service.ingestionSchedule
                            ? getFrequencyTime(
                                service.ingestionSchedule.repeatFrequency
                              )
                            : '--'}
                        </span>
                      </div>
                      <div className="">
                        <label className="tw-mb-0">Type:</label>
                        <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                          {service.serviceType}
                        </span>
                      </div>
                    </div>
                    <div className="tw-flex tw-flex-col tw-justify-between tw-flex-none">
                      <div className="tw-flex tw-justify-end">
                        <button
                          className="tw-pr-2 focus:tw-outline-none"
                          onClick={() => handleEdit(service)}>
                          <SVGIcons alt="edit" icon="icon-edit" title="edit" />
                        </button>
                        <button
                          className="focus:tw-outline-none"
                          onClick={() => handleDelete(service.id)}>
                          <SVGIcons
                            alt="delete"
                            icon="icon-delete"
                            title="delete"
                          />
                        </button>
                      </div>
                      <div className="tw-flex tw-justify-end">
                        {/* {!isNull(serviceTypeLogo(service.serviceType)) && (
                          <img
                            alt=""
                            className="tw-h-10 tw-w-10"
                            src={serviceTypeLogo(service.serviceType)}
                          />
                        )} */}
                        {getServiceLogo(service.serviceType)}
                      </div>
                    </div>
                  </div>
                ))}
                <div
                  className="tw-cursor-pointer tw-card tw-flex tw-flex-col tw-justify-center tw-items-center tw-py-6"
                  onClick={() => handleAddService()}>
                  <img alt="Add service" src={PLUS} />
                  <p className="tw-text-base tw-font-normal tw-mt-4">
                    Add new {servicesDisplayName[serviceName]}
                  </p>
                </div>
              </div>
            ) : (
              <div className="tw-flex tw-items-center tw-flex-col">
                <div className="tw-mt-24">
                  <img alt="No Service" src={NOSERVICE} />
                </div>
                <div className="tw-mt-11">
                  <p className="tw-text-lg">
                    No services found.{' '}
                    <button
                      className="link-text tw-underline"
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
          </div>
        </PageContainer>
      ) : (
        <Loader />
      )}
    </>
  );
};

export default ServicesPage;
