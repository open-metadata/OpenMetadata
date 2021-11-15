import { AxiosError, AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import {
  deleteIngestionWorkflowsById,
  getIngestionWorkflows,
  triggerIngestionWorkflowsById,
} from '../../axiosAPIs/ingestionWorkflowAPI';
import { getServices } from '../../axiosAPIs/serviceAPI';
import Ingestion from '../../components/Ingestion/Ingestion.component';
import Loader from '../../components/Loader/Loader';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import useToastContext from '../../hooks/useToastContext';

const IngestionPage = () => {
  const showToast = useToastContext();
  const [isLoading, setIsLoading] = useState(true);
  const [ingestions, setIngestions] = useState([]);
  const [serviceList, setServiceList] = useState<Array<DatabaseService>>([]);

  const getDatabaseServices = () => {
    getServices('databaseServices')
      .then((res: AxiosResponse) => {
        setServiceList(res.data.data);
      })
      .catch((err: AxiosError) => {
        // eslint-disable-next-line
        console.log(err);
      });
  };

  const getAllIngestionWorkflows = () => {
    getIngestionWorkflows('owner, service, tags, status').then((res) => {
      if (res.data.data) {
        setIngestions(res.data.data);
        setIsLoading(false);
      }
    });
  };

  const triggerIngestionById = (
    id: string,
    displayName: string
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      triggerIngestionWorkflowsById(id)
        .then((res) => {
          if (res.data) {
            resolve();
            getAllIngestionWorkflows();
          } else {
            reject();
          }
        })
        .catch((err: AxiosError) => {
          const msg = err.message;
          showToast({
            variant: 'error',
            body:
              msg ?? `Error while triggering ingestion workflow ${displayName}`,
          });
          reject();
        });
    });
  };

  const deleteIngestionById = (
    id: string,
    displayName: string
  ): Promise<void> => {
    return new Promise<void>((resolve, reject) => {
      deleteIngestionWorkflowsById(id)
        .then(() => {
          resolve();
          getAllIngestionWorkflows();
        })
        .catch((err: AxiosError) => {
          const msg = err.message;
          showToast({
            variant: 'error',
            body:
              msg ?? `Error while deleting ingestion workflow ${displayName}`,
          });
          reject();
        });
    });
  };

  useEffect(() => {
    getDatabaseServices();
    getAllIngestionWorkflows();
  }, []);

  return (
    <>
      {isLoading ? (
        <Loader />
      ) : (
        <Ingestion
          deleteIngestion={deleteIngestionById}
          ingestionList={ingestions}
          serviceList={serviceList}
          triggerIngestion={triggerIngestionById}
        />
      )}
    </>
  );
};

export default IngestionPage;
