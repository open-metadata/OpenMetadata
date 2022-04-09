import { AxiosError, AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { getGlossaries } from '../../axiosAPIs/glossaryAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import GlossaryComponent from '../../components/Glossary/Glossary.component';
import Loader from '../../components/Loader/Loader';
import { pagingObject } from '../../constants/constants';
import { Glossary } from '../../generated/entity/data/glossary';
import { Paging } from '../../generated/type/paging';
import jsonData from '../../jsons/en';
import { showErrorToast } from '../../utils/ToastUtils';

const GlossaryPage = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [paging, setPaging] = useState<Paging>(pagingObject);
  const [glossariesList, setGlossariesList] = useState<Array<Glossary>>([]);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchData = (pagin = '') => {
    setIsLoading(true);
    getGlossaries(pagin, ['owner', 'tags', 'reviewers'])
      .then((res: AxiosResponse) => {
        if (res.data?.data) {
          setGlossariesList(res.data.data);
          setPaging(res.data.paging);
        } else {
          setGlossariesList([]);
          setPaging(pagingObject);
        }
      })
      .catch((err: AxiosError) => {
        showErrorToast(err, jsonData['api-error-messages']['unexpected-error']);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handlePageChange = (
    cursorType: string | number,
    activePage?: number
  ) => {
    const pagingString = `&${cursorType}=${
      paging[cursorType as keyof typeof paging]
    }`;
    fetchData(pagingString);
    setCurrentPage(activePage ?? 1);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <PageContainerV1 className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : (
        <GlossaryComponent
          currentPage={currentPage}
          data={glossariesList}
          paging={paging}
          onPageChange={handlePageChange}
        />
      )}
    </PageContainerV1>
  );
};

export default GlossaryPage;
