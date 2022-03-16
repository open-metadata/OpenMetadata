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
import { compare } from 'fast-json-patch';
import { cloneDeep, extend, isEmpty } from 'lodash';
import {
  FormattedGlossarySuggestion,
  GlossarySuggestionHit,
  GlossaryTermAssets,
  LoadingState,
  SearchResponse,
} from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { useAuthContext } from '../../auth-provider/AuthProvider';
import {
  deleteGlossary,
  deleteGlossaryTerm,
  getGlossariesByName,
  getGlossaryTermByFQN,
  patchGlossaries,
  patchGlossaryTerm,
} from '../../axiosAPIs/glossaryAPI';
import { searchData } from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import GlossaryV1 from '../../components/Glossary/GlossaryV1.component';
import Loader from '../../components/Loader/Loader';
import {
  getAddGlossaryTermsPath,
  getGlossaryPath,
  PAGE_SIZE,
  ROUTES,
} from '../../constants/constants';
import { myDataSearchIndex } from '../../constants/Mydata.constants';
import { SearchIndex } from '../../enums/search.enum';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import { useAuth } from '../../hooks/authHooks';
import useToastContext from '../../hooks/useToastContext';
import { formatDataResponse } from '../../utils/APIUtils';
import {
  getChildGlossaryTerms,
  getGlossariesWithRootTerms,
  getHierarchicalKeysByFQN,
  getTermDataFromGlossary,
  getTermPosFromGlossaries,
  updateGlossaryListBySearchedTerms,
} from '../../utils/GlossaryUtils';

export type ModifiedGlossaryData = Glossary & {
  children?: GlossaryTerm[];
};

const GlossaryPageV1 = () => {
  const { glossaryName } = useParams<Record<string, string>>();

  const { isAdminUser } = useAuth();
  const { isAuthDisabled } = useAuthContext();
  const history = useHistory();
  const showToast = useToastContext();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChildLoading, setIsChildLoading] = useState(true);
  const [glossaries, setGlossaries] = useState<Array<ModifiedGlossaryData>>([]);
  const [glossariesList, setGlossariesList] = useState<
    Array<ModifiedGlossaryData>
  >([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [expandedKey, setExpandedKey] = useState<string[]>([]);
  const [loadingKey, setLoadingKey] = useState<string[]>([]);
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();
  const [isGlossaryActive, setIsGlossaryActive] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<LoadingState>('initial');
  const [isSearchResultEmpty, setIsSearchResultEmpty] =
    useState<boolean>(false);
  const [assetData, setAssetData] = useState<GlossaryTermAssets>({
    data: [],
    total: 0,
    currPage: 1,
  });

  const handleChildLoading = (status: boolean) => {
    setIsChildLoading(status);
  };

  const handleSelectedKey = (key: string) => {
    setSelectedKey(key);
  };

  const handleExpandedKey = (key: string[]) => {
    setExpandedKey(key);
  };

  const handleSearchText = (text: string) => {
    setSearchText(text);
  };

  const initSelectGlossary = (data: Glossary, noSetData = false) => {
    if (!noSetData) {
      setSelectedData(data);
      setIsGlossaryActive(true);
      setSelectedKey(data.name);
    }
    setExpandedKey([data.name]);
  };

  const fetchGlossaryTermByName = (
    fqn: string,
    pos: number[],
    arrGlossary: ModifiedGlossaryData[]
  ) => {
    getGlossaryTermByFQN(fqn, ['children', 'relatedTerms', 'reviewers', 'tags'])
      .then(async (res: AxiosResponse) => {
        const { data } = res;
        if (data) {
          const clonedGlossaryList = cloneDeep(arrGlossary);
          let treeNode = clonedGlossaryList[pos[0]];

          for (let i = 1; i < pos.length; i++) {
            if (treeNode.children) {
              treeNode = treeNode.children[+pos[i]] as ModifiedGlossaryData;
            } else {
              break;
            }
          }

          let children = [...(treeNode.children || [])] as GlossaryTerm[];

          let childTerms = [] as GlossaryTerm[];
          if (data.children?.length) {
            childTerms = await getChildGlossaryTerms(
              (data.children as GlossaryTerm[]).map(
                (item) => item.fullyQualifiedName || item.name
              )
            );
          }

          children = childTerms.reduce((prev, curr) => {
            let arrData = [] as GlossaryTerm[];
            for (let i = 0; i < prev.length; i++) {
              const item = prev[i];
              const itemFQN = item.fullyQualifiedName || item.name;
              const currFQN = curr.fullyQualifiedName || curr.name;

              if (itemFQN === currFQN) {
                if (item.children?.length !== curr.children?.length) {
                  arrData = [...prev.slice(0, i), curr, ...prev.slice(i + 1)];
                } else {
                  arrData = [...prev];
                }

                break;
              }
            }

            return arrData.length ? arrData : [...prev, curr];
          }, children);

          extend(treeNode, { ...data, children });

          setSelectedData(data);
          if (fqn) {
            if (!expandedKey.length) {
              setExpandedKey(getHierarchicalKeysByFQN(fqn));
            }
            handleSelectedKey(fqn);
          }
          setGlossariesList(clonedGlossaryList);
          setIsGlossaryActive(false);
        }
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body:
            err.response?.data?.message ??
            'Error while fetching glossary terms!',
        });
      })
      .finally(() => {
        setIsLoading(false);
        handleChildLoading(false);
        setLoadingKey((pre) => {
          return pre.filter((item) => item !== fqn);
        });
      });
  };

  const fetchGlossaryTermAssets = (fqn: string, forceReset = false) => {
    if (fqn) {
      const tagName = fqn;
      searchData(
        '',
        forceReset ? 1 : assetData.currPage,
        PAGE_SIZE,
        `(tags:"${tagName}")`,
        '',
        '',
        myDataSearchIndex
      ).then((res: SearchResponse) => {
        const hits = res.data.hits.hits;
        if (hits.length > 0) {
          setAssetData((pre) => {
            const data = formatDataResponse(hits);
            const total = res.data.hits.total.value;

            return forceReset
              ? {
                  data,
                  total,
                  currPage: 1,
                }
              : { ...pre, data, total };
          });
        } else {
          setAssetData((pre) => {
            const data = [] as GlossaryTermAssets['data'];
            const total = 0;

            return forceReset
              ? {
                  data,
                  total,
                  currPage: 1,
                }
              : { ...pre, data, total };
          });
        }
      });
    } else {
      setAssetData({ data: [], total: 0, currPage: 1 });
    }
  };

  const selectDataByFQN = (
    dataFQN: string,
    arrGlossary: ModifiedGlossaryData[]
  ) => {
    handleChildLoading(true);
    const hierarchy = getTermPosFromGlossaries(arrGlossary, dataFQN);
    if (hierarchy.length < 2) {
      setSelectedData(arrGlossary[hierarchy[0]]);
      handleSelectedKey(dataFQN);
      if (!expandedKey.length) {
        setExpandedKey([dataFQN]);
      }
      setIsGlossaryActive(true);
      setIsLoading(false);
      handleChildLoading(false);
    } else {
      setLoadingKey((pre) => {
        return !pre.includes(dataFQN) ? [...pre, dataFQN] : pre;
      });
      fetchGlossaryTermByName(dataFQN, hierarchy, arrGlossary);
      fetchGlossaryTermAssets(dataFQN, true);
    }
  };

  const checkAndFetchDataByFQN = (
    arrGlossary: ModifiedGlossaryData[],
    fqn: string
  ) => {
    let modifiedData = cloneDeep(arrGlossary);
    const arrFQN = getHierarchicalKeysByFQN(fqn);
    const glossary: ModifiedGlossaryData | GlossaryTerm = modifiedData.find(
      (item) => item.name === arrFQN[0]
    ) as ModifiedGlossaryData;
    const data = getTermDataFromGlossary(glossary, fqn);
    if (isEmpty(data)) {
      modifiedData = updateGlossaryListBySearchedTerms(modifiedData, [
        { fqdn: arrFQN[arrFQN.length - 1] },
      ] as FormattedGlossarySuggestion[]);
    }
    selectDataByFQN(fqn, modifiedData);
  };

  const fetchGlossaryList = (termFqn = '', paging = '') => {
    setIsLoading(true);
    getGlossariesWithRootTerms(paging, 1000, ['owner', 'tags', 'reviewers'])
      .then((data: ModifiedGlossaryData[]) => {
        if (data?.length) {
          setGlossaries(data);
          setGlossariesList(data);
          if (termFqn) {
            checkAndFetchDataByFQN(data, termFqn);
          } else {
            initSelectGlossary(data[0]);
            setIsLoading(false);
            handleChildLoading(false);
          }
        } else {
          setGlossariesList([]);
          setIsLoading(false);
          handleChildLoading(false);
        }
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.response?.data?.message ?? 'Something went wrong!',
        });
        setIsLoading(false);
        handleChildLoading(false);
      });
  };

  const getSearchedGlossaries = (
    arrGlossaries: ModifiedGlossaryData[],
    newGlossaries: string[],
    searchedTerms: FormattedGlossarySuggestion[]
  ) => {
    if (newGlossaries.length) {
      let arrNewData: ModifiedGlossaryData[] = [];
      const promiseArr = newGlossaries.map((item) => {
        return getGlossariesByName(item, ['owner', 'tags', 'reviewers']);
      });
      Promise.all(promiseArr).then((res) => {
        arrNewData = res.reduce((prev, curr) => {
          return curr?.data ? [...prev, curr.data] : prev;
        }, [] as ModifiedGlossaryData[]);
        const arrData = updateGlossaryListBySearchedTerms(
          [...arrGlossaries, ...arrNewData],
          searchedTerms
        );
        setGlossariesList(arrData);
        setExpandedKey(getHierarchicalKeysByFQN(searchedTerms[0].fqdn));
      });
    } else {
      const arrData = updateGlossaryListBySearchedTerms(
        arrGlossaries,
        searchedTerms
      );
      setGlossariesList(arrData);
      setExpandedKey(getHierarchicalKeysByFQN(searchedTerms[0].fqdn));
    }
  };

  const fetchSearchedTerms = useCallback(() => {
    if (searchText) {
      searchData(
        searchText,
        1,
        PAGE_SIZE,
        '',
        '',
        '',
        SearchIndex.GLOSSARY
      ).then((res: AxiosResponse) => {
        if (res.data) {
          const searchedTerms: FormattedGlossarySuggestion[] =
            res.data.hits?.hits?.map(
              (item: GlossarySuggestionHit) => item._source
            ) || [];
          if (searchedTerms.length) {
            const searchedGlossaries: string[] = [
              ...new Set(
                searchedTerms.map((item) => {
                  return item.glossary_name;
                }) as string[]
              ),
            ];
            const searchedData: ModifiedGlossaryData[] = [];
            const newGlossaries: string[] = [];
            for (const glossary of searchedGlossaries) {
              const obj = glossariesList.find((item) => item.name === glossary);
              if (obj) {
                searchedData.push(obj);
              } else {
                newGlossaries.push(glossary);
              }
            }
            getSearchedGlossaries(searchedData, newGlossaries, searchedTerms);
            setIsSearchResultEmpty(false);
          } else if (glossaries.length) {
            setGlossariesList(glossaries);
            setIsSearchResultEmpty(true);
          }
        }
      });
    } else {
      setGlossariesList(glossaries);
      if (glossaries.length) {
        initSelectGlossary(glossaries[0], true);
      }
      setIsSearchResultEmpty(false);
    }
  }, [searchText]);

  const saveUpdatedGlossaryData = (
    updatedData: Glossary
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(selectedData as Glossary, updatedData);

    return patchGlossaries(
      selectedData?.id as string,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const updateGlossary = (updatedData: Glossary) => {
    saveUpdatedGlossaryData(updatedData)
      .then((res: AxiosResponse) => {
        if (res?.data) {
          const { data } = res;
          setSelectedData(data);
          setGlossaries((pre) => {
            return pre.map((item) => {
              if (item.name === data.name) {
                const { children } = item;

                return extend(cloneDeep(item), { ...data, children });
              } else {
                return item;
              }
            });
          });
          setGlossariesList((pre) => {
            return pre.map((item) => {
              if (item.name === data.name) {
                const { children } = item;

                return extend(cloneDeep(item), { ...data, children });
              } else {
                return item;
              }
            });
          });
        }
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body:
            err.response?.data?.message ?? 'Error while updating description!',
        });
      });
  };

  const saveUpdatedGlossaryTermData = (
    updatedData: GlossaryTerm
  ): Promise<AxiosResponse> => {
    const jsonPatch = compare(selectedData as GlossaryTerm, updatedData);

    return patchGlossaryTerm(
      selectedData?.id as string,
      jsonPatch
    ) as unknown as Promise<AxiosResponse>;
  };

  const handleGlossaryTermUpdate = (updatedData: GlossaryTerm) => {
    saveUpdatedGlossaryTermData(updatedData)
      .then((res: AxiosResponse) => {
        setSelectedData(res.data);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body:
            err.response?.data?.message ?? 'Error while updating glossaryTerm!',
        });
      });
  };

  const handleGlossaryDelete = (id: string) => {
    setDeleteStatus('waiting');
    deleteGlossary(id)
      .then(() => {
        setDeleteStatus('initial');
        fetchGlossaryList();
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.response?.data?.message ?? 'Something went wrong!',
        });
        setDeleteStatus('initial');
      });
  };

  const handleGlossaryTermDelete = (id: string) => {
    setDeleteStatus('waiting');
    deleteGlossaryTerm(id)
      .then(() => {
        setDeleteStatus('initial');
        fetchGlossaryList();
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.response?.data?.message ?? 'Something went wrong!',
        });
        setDeleteStatus('initial');
      });
  };

  const handleAddGlossaryClick = () => {
    history.push(ROUTES.ADD_GLOSSARY);
  };

  const handleAddGlossaryTermClick = () => {
    const activeTerm = selectedKey.split('.');
    const glossaryName = activeTerm[0];
    if (activeTerm.length > 1) {
      history.push(getAddGlossaryTermsPath(glossaryName, selectedKey));
    } else {
      history.push(getAddGlossaryTermsPath(glossaryName));
    }
  };

  const handleAssetPagination = (page: number) => {
    setAssetData((pre) => ({ ...pre, currPage: page }));
  };

  const handleSelectedData = (key: string) => {
    const path = getGlossaryPath(key);
    history.push(path);
  };

  const fetchData = () => {
    if (glossariesList.length) {
      checkAndFetchDataByFQN(glossariesList, glossaryName);
    } else {
      fetchGlossaryList(glossaryName);
    }
  };

  useEffect(() => {
    fetchGlossaryTermAssets(
      (selectedData as GlossaryTerm)?.fullyQualifiedName || ''
    );
  }, [assetData.currPage]);

  useEffect(() => {
    fetchSearchedTerms();
  }, [searchText]);

  useEffect(() => {
    fetchData();
  }, [glossaryName]);

  return (
    <PageContainerV1 className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : (
        <GlossaryV1
          assetData={assetData}
          deleteStatus={deleteStatus}
          expandedKey={expandedKey}
          glossaryList={glossariesList as ModifiedGlossaryData[]}
          handleAddGlossaryClick={handleAddGlossaryClick}
          handleAddGlossaryTermClick={handleAddGlossaryTermClick}
          handleChildLoading={handleChildLoading}
          handleExpandedKey={handleExpandedKey}
          handleGlossaryTermUpdate={handleGlossaryTermUpdate}
          handleSearchText={handleSearchText}
          handleSelectedData={handleSelectedData}
          isChildLoading={isChildLoading}
          isGlossaryActive={isGlossaryActive}
          isHasAccess={!isAdminUser && !isAuthDisabled}
          isSearchResultEmpty={isSearchResultEmpty}
          loadingKey={loadingKey}
          searchText={searchText}
          selectedData={selectedData as Glossary | GlossaryTerm}
          selectedKey={selectedKey}
          updateGlossary={updateGlossary}
          onAssetPaginate={handleAssetPagination}
          onGlossaryDelete={handleGlossaryDelete}
          onGlossaryTermDelete={handleGlossaryTermDelete}
        />
      )}
    </PageContainerV1>
  );
};

export default GlossaryPageV1;
