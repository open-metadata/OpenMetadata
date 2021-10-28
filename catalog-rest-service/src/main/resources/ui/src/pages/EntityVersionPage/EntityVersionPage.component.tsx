import { AxiosError, AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  getTableDetailsByFQN,
  getTableVersions,
} from '../../axiosAPIs/tableAPI';
import PageContainer from '../../components/containers/PageContainer';
import EntityVersionTimeLine from '../../components/EntityVersionTimeLine/EntityVersionTimeLine';
import Loader from '../../components/Loader/Loader';
import { EntityHistory } from '../../generated/type/entityHistory';
import useToastContext from '../../hooks/useToastContext';
import { getPartialNameFromFQN } from '../../utils/CommonUtils';
const EntityVersionPage = () => {
  const showToast = useToastContext();
  const { datasetFQN } = useParams() as Record<string, string>;
  const [isLoading, setIsloading] = useState<boolean>(false);
  const [versionList, setVersionList] = useState<EntityHistory>(
    {} as EntityHistory
  );

  useEffect(() => {
    setIsloading(true);
    getTableDetailsByFQN(
      getPartialNameFromFQN(datasetFQN, ['service', 'database', 'table'], '.')
    )
      .then((res: AxiosResponse) => {
        const { id } = res.data;
        getTableVersions(id)
          .then((vres: AxiosResponse) => {
            setVersionList(vres.data);
            setIsloading(false);
          })
          .catch((err: AxiosError) => {
            const msg = err.message;
            showToast({
              variant: 'error',
              body: msg ?? `Error while fetching ${datasetFQN} versions`,
            });
          });
      })
      .catch((err: AxiosError) => {
        const msg = err.message;
        showToast({
          variant: 'error',
          body: msg ?? `Error while fetching ${datasetFQN} versions`,
        });
      });
  }, [datasetFQN]);

  return (
    <PageContainer>
      {isLoading ? (
        <Loader />
      ) : (
        <div className="tw-px-4 tw-w-full tw-h-full tw-flex tw-flex-col tw-relative">
          <EntityVersionTimeLine versionList={versionList} />
        </div>
      )}
    </PageContainer>
  );
};

export default EntityVersionPage;
