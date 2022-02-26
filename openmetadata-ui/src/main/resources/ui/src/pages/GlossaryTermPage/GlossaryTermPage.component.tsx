import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { isEmpty } from 'lodash';
import { Key } from 'rc-tree/lib/interface';
import React, { FunctionComponent, useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import {
  getGlossariesByName,
  getGlossaryTerms,
  getGlossaryTermsByName,
  patchGlossaries,
} from '../../axiosAPIs/glossaryAPI';
import { TitleBreadcrumbProps } from '../../components/common/title-breadcrumb/title-breadcrumb.interface';
import PageContainer from '../../components/containers/PageContainer';
import GlossaryTerms from '../../components/GlossaryTerms/GlossaryTerms.component';
import Loader from '../../components/Loader/Loader';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';

const GlossaryTermPage: FunctionComponent = () => {
  const showToast = useToastContext();
  const { isAdminUser, isAuthDisabled } = useAuth();
  const { glossaryName, glossaryTermsFQN } =
    useParams<{ [key: string]: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [glossaryData, setGlossaryData] = useState<Glossary>();
  const [glossaryTerms, setGlossaryTerms] = useState<Array<GlossaryTerm>>([]);
  const [activeGlossaryTerm, setActiveGlossaryTerm] = useState<GlossaryTerm>();
  const [slashedTableName, setSlashedTableName] = useState<
    TitleBreadcrumbProps['titleLinks']
  >([]);
  const [activeTab, setActiveTab] = useState<number>(1);
  const [selectedKeys, setSelectedKeys] = useState<string>('');
  const [expandedKeys, setExpandedKeys] = useState<Array<string>>([]);
  const [queryParams, setQueryParams] = useState<Array<string>>([]);
  const [showGlossaryDetails, setShowGlossaryDetails] = useState(
    !glossaryTermsFQN
  );

  const location = useLocation();

  const activeTabHandler = (value: number) => {
    setActiveTab(value);
  };

  const fetchGlossaryTermsData = (id?: string) => {
    setIsLoading(true);
    getGlossaryTerms(id, ['children', 'relatedTerms', 'reviewers', 'tags'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        setGlossaryTerms(data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Error while fetching glossary terms!',
        });
      })
      .finally(() => setIsLoading(false));
  };

  const fetchGlossaryTermsByName = (name: string) => {
    getGlossaryTermsByName(name, [
      'children',
      'relatedTerms',
      'reviewers',
      'tags',
    ])
      .then((res: AxiosResponse) => {
        setActiveGlossaryTerm(res.data);
      })
      .catch((err: AxiosError) => {
        setActiveGlossaryTerm(undefined);
        showToast({
          variant: 'error',
          body: err.message || 'Error while fetching glossary terms!',
        });
      });
  };

  const fetchGlossaryData = () => {
    setIsLoading(true);
    getGlossariesByName(glossaryName, ['tags', 'owner'])
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
        setSlashedTableName([
          {
            name: glossaryName,
            url: '',
            activeTitle: true,
          },
        ]);
        fetchGlossaryTermsData(res.data.id);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Error while fetching glossary!',
        });
        setIsLoading(false);
      });
  };

  const handleActiveGlossaryTerm = (
    term: GlossaryTerm | undefined,
    id: string
  ) => {
    if (term) {
      setActiveGlossaryTerm(term);
    } else {
      fetchGlossaryTermsByName(id);
    }
  };

  const handleSelectedKey = (key: string) => {
    setSelectedKeys(key);
  };

  const handleExpand = (key: Key[]) => {
    setExpandedKeys(key as string[]);
  };

  const saveUpdatedGlossaryData = (
    updatedData: Glossary
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(glossaryData as Glossary, updatedData);

    return patchGlossaries(
      glossaryData?.id as string,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const updateGlossaryDescription = (updatedData: Glossary) => {
    saveUpdatedGlossaryData(updatedData)
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Error while updating description!',
        });
      });
  };

  const updateReviewer = (updatedData: Glossary) => {
    saveUpdatedGlossaryData(updatedData)
      .then((res: AxiosResponse) => {
        setGlossaryData(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Error while updating reviewer!',
        });
      });
  };

  useEffect(() => {
    if (!isEmpty(glossaryTermsFQN)) {
      // let query: string | string[] = location.search
      //   ? location.search.split('=')[1]
      //   : '';
      // query = query.split(',');
      const query = glossaryTermsFQN.split('.');
      query.shift();
      setQueryParams(query);
    }

    setShowGlossaryDetails(!glossaryTermsFQN);
  }, [location.pathname]);

  useEffect(() => {
    fetchGlossaryData();
  }, [glossaryName]);

  return (
    <PageContainer className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : (
        <GlossaryTerms
          activeGlossaryTerm={activeGlossaryTerm}
          activeTab={activeTab}
          activeTabHandler={activeTabHandler}
          allowAccess={isAdminUser || isAuthDisabled}
          expandedKeys={expandedKeys}
          glossaryDetails={glossaryData as Glossary}
          glossaryTermsDetails={glossaryTerms}
          handleActiveGlossaryTerm={handleActiveGlossaryTerm}
          handleExpand={handleExpand}
          handleSelectedKey={handleSelectedKey}
          queryParams={queryParams}
          selectedKeys={selectedKeys}
          showGlossaryDetails={showGlossaryDetails}
          slashedTableName={slashedTableName}
          updateGlossaryDescription={updateGlossaryDescription}
          updateReviewer={updateReviewer}
        />
      )}
    </PageContainer>
  );
};

export default GlossaryTermPage;
