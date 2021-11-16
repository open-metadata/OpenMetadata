import { AxiosError, AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import {
  addIngestionWorkflow,
  deleteIngestionWorkflowsById,
  getIngestionWorkflows,
  triggerIngestionWorkflowsById,
} from '../../axiosAPIs/ingestionWorkflowAPI';
import { getServices } from '../../axiosAPIs/serviceAPI';
import Ingestion from '../../components/Ingestion/Ingestion.component';
import { IngestionData } from '../../components/Ingestion/ingestion.interface';
import Loader from '../../components/Loader/Loader';
import { DatabaseService } from '../../generated/entity/services/databaseService';
import { EntityReference } from '../../generated/type/entityReference';
import useToastContext from '../../hooks/useToastContext';
import { getCurrentUserId } from '../../utils/CommonUtils';
import { getOwnerFromId } from '../../utils/TableUtils';

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

  const addIngestionWorkflowHandler = (
    data: IngestionData,
    triggerIngestion?: boolean
  ) => {
    setIsLoading(true);
    const service = serviceList.find((s) => s.name === data.service.name);
    const owner = getOwnerFromId(getCurrentUserId());
    const ingestionData = {
      ...data,
      service: {
        id: service?.id,
        type: 'databaseService',
        name: data.service.name,
      } as EntityReference,
      owner: {
        id: owner?.id,
        name: owner?.name,
        type: 'user',
      },
    };

    addIngestionWorkflow(ingestionData)
      .then((res: AxiosResponse) => {
        const { id, displayName } = res.data;
        setIsLoading(false);
        getAllIngestionWorkflows();
        if (triggerIngestion) {
          triggerIngestionById(id, displayName).then();
        }
      })
      .catch(() => setIsLoading(false));
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
          addIngestion={addIngestionWorkflowHandler}
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
