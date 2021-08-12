import { AxiosResponse } from 'axios';
import { ServiceCollection, ServiceData } from 'Models';
import { getServiceDetails, getServices } from '../axiosAPIs/serviceAPI';
import { ServiceDataObj } from '../components/Modals/AddServiceModal/AddServiceModal';
import {
  BIGQUERY,
  HIVE,
  MYSQL,
  ORACLE,
  POSTGRES,
  REDSHIFT,
  SNOWFLAKE,
} from '../constants/services.const';
import { ServiceType } from '../enums/service.enum';
import { ApiData } from '../pages/services';

export const serviceTypeLogo = (type: string) => {
  switch (type) {
    case ServiceType.MYSQL:
      return MYSQL;

    case ServiceType.REDSHIFT:
      return REDSHIFT;

    case ServiceType.BIGQUERY:
      return BIGQUERY;

    case ServiceType.HIVE:
      return HIVE;

    case ServiceType.POSTGRES:
      return POSTGRES;

    case ServiceType.ORACLE:
      return ORACLE;

    case ServiceType.SNOWFLAKE:
      return SNOWFLAKE;

    default:
      return MYSQL;
  }
};

const getAllServiceList = (
  allServiceCollectionArr: Array<ServiceCollection>
): Promise<Array<ServiceDataObj>> => {
  let listArr = [];

  //   fetch services of all individual collection
  return new Promise<Array<ServiceDataObj>>((resolve, reject) => {
    if (allServiceCollectionArr.length) {
      let promiseArr = [];
      promiseArr = allServiceCollectionArr.map((obj) => {
        return getServices(obj.value);
      });
      Promise.all(promiseArr)
        .then((result: AxiosResponse[]) => {
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
            resolve(listArr);
          } else {
            resolve([]);
          }
        })
        .catch((err) => reject(err));
    } else {
      resolve([]);
    }
  });
};

export const getAllServices = (): Promise<Array<ServiceDataObj>> => {
  return new Promise<Array<ServiceDataObj>>((resolve, reject) => {
    getServiceDetails().then((res: AxiosResponse) => {
      let allServiceCollectionArr: Array<ServiceCollection> = [];
      if (res.data.data?.length) {
        allServiceCollectionArr = res.data.data.map((service: ServiceData) => {
          return {
            name: service.collection.name,
            value: service.collection.name,
          };
        });
      }
      getAllServiceList(allServiceCollectionArr)
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    });
  });
};
