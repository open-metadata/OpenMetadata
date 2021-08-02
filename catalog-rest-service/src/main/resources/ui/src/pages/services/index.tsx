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
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  deleteService,
  getServiceDetails,
  getServices,
  postService,
  updateService,
} from '../../axiosAPIs/serviceAPI';
import PageContainer from '../../components/containers/PageContainer';
import Loader from '../../components/Loader/Loader';
import {
  AddServiceModal,
  DatabaseObj,
  DataObj,
  EditObj,
} from '../../components/Modals/AddServiceModal/AddServiceModal';
import { getServiceDetailsPath } from '../../constants/constants';
import { NOSERVICE, PLUS } from '../../constants/services.const';
import { serviceTypeLogo } from '../../utils/ServiceUtils';
import { stringToHTML } from '../../utils/StringsUtils';
type ServiceData = {
  collection: {
    documentation: string;
    href: string;
    name: string;
  };
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

type ServiceCollection = { name: string; value: string };

const ServicesPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [serviceName] = useState('databaseServices');
  const [serviceList, setServiceList] = useState<Array<DataObj>>([]);
  const [editData, setEditData] = useState<DataObj>();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const updateServiceList = (
    allServiceCollectionArr: Array<ServiceCollection>
  ) => {
    let listArr = [];
    //   fetch services of all individual collection
    if (allServiceCollectionArr.length) {
      let promiseArr = [];
      promiseArr = allServiceCollectionArr.map((obj) => {
        return getServices(obj.value);
      });
      Promise.all(promiseArr).then((result: AxiosResponse[]) => {
        if (result.length) {
          let serviceArr = [];
          serviceArr = result.map((service) => service?.data?.data || []);
          // converted array of arrays to array
          const allServices = serviceArr.reduce(
            (acc, el) => acc.concat(el),
            []
          );
          listArr = allServices.map((s: ApiData) => {
            return { ...s, ...s.jdbc };
          });
          setServiceList(listArr);
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

  const handleEdit = (value: DataObj) => {
    setEditData(value);
    setIsModalOpen(true);
  };

  const handleUpdate = (
    selectedService: string,
    id: string,
    dataObj: DatabaseObj
  ) => {
    updateService(selectedService, id, dataObj).then(
      ({ data }: { data: AxiosResponse['data'] }) => {
        const updatedData = {
          ...data,
          ...data.jdbc,
        };
        const updatedServiceList = serviceList.map((s) =>
          s.id === updatedData.id ? updatedData : s
        );
        setServiceList(updatedServiceList);
      }
    );
  };

  const handleAdd = (selectedService: string, dataObj: DatabaseObj) => {
    postService(selectedService, dataObj).then(
      ({ data }: { data: AxiosResponse['data'] }) => {
        const updatedData = {
          ...data,
          ...data.jdbc,
        };
        setServiceList([...serviceList, updatedData]);
      }
    );
  };

  const handleSave = (
    dataObj: DatabaseObj,
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
        setServiceList(updatedServiceList);
      }
    });
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
            {serviceList.length ? (
              <div className="tw-grid tw-grid-cols-4 tw-gap-4">
                {serviceList.map((service, index) => (
                  <div
                    className="tw-card tw-flex tw-py-2 tw-px-3 tw-justify-between tw-text-gray-500"
                    key={index}>
                    <div className="tw-flex-auto">
                      <Link to={getServiceDetailsPath(service.name)}>
                        <button>
                          <h6 className="tw-text-base tw-text-grey-body tw-font-medium">
                            {service.name}
                          </h6>
                        </button>
                      </Link>
                      <div className="tw-text-grey-body tw-pb-1">
                        {stringToHTML(service.description) ||
                          'No description added'}
                      </div>
                      {/* <div className="tw-my-2">
                    <label className="tw-font-semibold ">Tags:</label>
                    <span className="tw-tag tw-ml-3">mysql</span>
                    <span className="tw-tag tw-ml-2">sales</span>
                  </div> */}
                      <div className="">
                        <label className="tw-mb-0">Type:</label>
                        <span className=" tw-ml-1 tw-font-normal tw-text-grey-body">
                          {service.serviceType}
                        </span>
                      </div>
                    </div>
                    <div className="tw-flex tw-flex-col tw-justify-between tw-flex-1">
                      <div className="tw-flex tw-justify-end">
                        <button
                          className="tw-pr-2"
                          onClick={() => handleEdit(service)}>
                          <i className="far fa-edit tw-text-gray-500 tw-cursor-pointer hover:tw-text-gray-700" />
                        </button>
                        <button onClick={() => handleDelete(service.id)}>
                          <i className="far fa-trash-alt tw-text-gray-500 tw-cursor-pointer hover:tw-text-gray-700" />
                        </button>
                      </div>
                      <div className="tw-flex tw-justify-end">
                        <img
                          alt=""
                          className="tw-h-10 tw-w-10 tw-filter tw-grayscale tw-opacity-50"
                          src={serviceTypeLogo(service.serviceType)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div
                  className="tw-cursor-pointer tw-card tw-bg-gray-200 tw-flex tw-flex-col tw-justify-center tw-items-center tw-py-2"
                  onClick={() => handleAddService()}>
                  <img alt="" src={PLUS} />
                  <p
                    className="tw-text-base tw-font-medium tw-mt-1"
                    style={{ color: 'rgba(3, 102, 214, 1)' }}>
                    Add new service
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
                      className="tw-text-blue-700 tw-cursor-pointer tw-underline"
                      onClick={handleAddService}>
                      Click here
                    </button>{' '}
                    to add new services
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
