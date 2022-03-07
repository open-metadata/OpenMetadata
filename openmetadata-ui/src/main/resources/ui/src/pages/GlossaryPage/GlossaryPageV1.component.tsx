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
import { cloneDeep, extend } from 'lodash';
import {
  FormatedGlossarySuggestion,
  GlossarySuggestionHit,
  GlossaryTermAssets,
  LoadingState,
  SearchResponse,
} from 'Models';
import React, { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  deleteGlossary,
  deleteGlossaryTerm,
  getGlossaries,
  getGlossariesByName,
  getGlossaryTermByFQN,
  getGlossaryTerms,
  patchGlossaries,
  patchGlossaryTerm,
} from '../../axiosAPIs/glossaryAPI';
import { getSuggestions, searchData } from '../../axiosAPIs/miscAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import GlossaryV1 from '../../components/Glossary/GlossaryV1.component';
import Loader from '../../components/Loader/Loader';
import { WILD_CARD_CHAR } from '../../constants/char.constants';
import {
  getAddGlossaryTermsPath,
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
  getHierarchicalKeysByFQN,
  updateGlossaryListBySearchedTerms,
} from '../../utils/GlossaryUtils';

export type ModifiedGlossaryData = Glossary & {
  children?: GlossaryTerm[];
};

const GlossaryPageV1 = () => {
  // const { glossaryName, glossaryTermsFQN } =
  // useParams<{ [key: string]: string }>();

  const { isAdminUser, isAuthDisabled } = useAuth();
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
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();
  const [isGlossaryActive, setIsGlossaryActive] = useState(true);
  const [searchText, setSearchText] = useState('');
  const [deleteStatus, setDeleteStatus] = useState<LoadingState>('initial');
  const [assetData, setAssetData] = useState<GlossaryTermAssets>({
    data: [],
    total: 0,
    currPage: 1,
  });

  const handleChildLoading = (status: boolean) => {
    setIsChildLoading(status);
  };

  const fetchGlossaryTermsData = (id?: string) => {
    getGlossaryTerms(id, 100, ['children', 'relatedTerms', 'reviewers', 'tags'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;

        // Filtering root level terms from glossary
        const updatedData = data.filter((d: GlossaryTerm) => !d.parent);

        setGlossariesList((pre) => {
          return pre.map((d) => {
            let data = d;
            if (d.id === id) {
              let { children } = d;
              children = ((updatedData as GlossaryTerm[]) || [])?.reduce(
                (prev, curr) => {
                  const data = prev.find((item) => {
                    const itemFQN = item.fullyQualifiedName || item.name;
                    const currFQN = curr.fullyQualifiedName || curr.name;

                    return itemFQN === currFQN;
                  });

                  return data ? [...prev] : [...prev, curr];
                },
                children || []
              );
              data = { ...d, children };
            }

            return data;
          });
        });
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
      });
  };

  const initSelectGlossary = (data: Glossary) => {
    setSelectedData(data);
    setSelectedKey(data.name);
    setExpandedKey([data.name]);
    fetchGlossaryTermsData(data.id);
    setIsGlossaryActive(true);
  };

  const fetchGlossaryList = (pagin = '') => {
    setIsLoading(true);
    getGlossaries(pagin, 100, ['owner', 'tags', 'reviewers'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        if (data?.length) {
          setGlossaries(data);
          setGlossariesList(data);
          initSelectGlossary(data[0]);
        } else {
          setGlossariesList([]);
          setIsLoading(false);
        }
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.response?.data?.message ?? 'Something went wrong!',
        });
        setIsLoading(false);
      })
      .finally(() => {
        handleChildLoading(false);
      });
  };

  const fetchGlossaryTermByName = (name: string, pos: string[]) => {
    getGlossaryTermByFQN(name, [
      'children',
      'relatedTerms',
      'reviewers',
      'tags',
    ])
      .then((res: AxiosResponse) => {
        const { data } = res;
        if (data) {
          const clonedGlossaryList = cloneDeep(glossariesList);
          let treeNode = clonedGlossaryList[+pos[0]];
          for (let i = 1; i < pos.length; i++) {
            if (treeNode.children) {
              treeNode = treeNode.children[+pos[i]] as ModifiedGlossaryData;
            } else {
              break;
            }
          }

          let children = [...(treeNode.children || [])];

          children = (
            (data.children as ModifiedGlossaryData['children']) || []
          )?.reduce((prev, curr) => {
            const data = prev.find((item) => {
              const itemFQN = item.fullyQualifiedName || item.name;
              const currFQN = curr.fullyQualifiedName || curr.name;

              return itemFQN === currFQN;
            });

            return data ? [...prev] : [...prev, curr];
          }, children);

          extend(treeNode, { ...data, children });

          setSelectedData(data);
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
      .finally(() => handleChildLoading(false));
  };

  const getSearchedGlossaries = (
    arrGlossaries: ModifiedGlossaryData[],
    newGlossaries: string[],
    searchedTerms: FormatedGlossarySuggestion[]
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
    getSuggestions(searchText, SearchIndex.GLOSSARY).then(
      (res: AxiosResponse) => {
        if (res.data) {
          const searchedTerms: FormatedGlossarySuggestion[] =
            res.data?.suggest['table-suggest'][0]?.options?.map(
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
                // newGlossaries.push(glossary);
              } else {
                newGlossaries.push(glossary);
              }
            }
            getSearchedGlossaries(searchedData, newGlossaries, searchedTerms);
          } else if (glossaries.length) {
            setGlossariesList(glossaries);
            initSelectGlossary(glossaries[0]);
          }
        }
      }
    );
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
        setSelectedData(res.data);
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

  const handleSelectedKey = (key: string) => {
    setSelectedKey(key);
  };

  const handleExpandedKey = (key: string[]) => {
    setExpandedKey(key);
  };

  const fetchGlossaryTermAssets = (data: GlossaryTerm, forceReset = false) => {
    if (data?.fullyQualifiedName) {
      searchData(
        WILD_CARD_CHAR,
        forceReset ? 1 : assetData.currPage,
        PAGE_SIZE,
        `(tags:${data.fullyQualifiedName})`,
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

  const handleAssetPagination = (page: number) => {
    setAssetData((pre) => ({ ...pre, currPage: page }));
  };

  const handleSelectedData = (data: Glossary | GlossaryTerm, pos: string) => {
    handleChildLoading(true);
    const hierarchy = pos.split('-').splice(1);
    // console.log(hierarchy);
    if (hierarchy.length < 2) {
      setSelectedData(data);
      fetchGlossaryTermsData(data.id);
      setIsGlossaryActive(true);
      handleChildLoading(false);
    } else {
      fetchGlossaryTermByName(
        (data as GlossaryTerm)?.fullyQualifiedName || data?.name,
        hierarchy
      );
      fetchGlossaryTermAssets(data as GlossaryTerm, true);
    }
  };

  const handleSearchText = (text: string) => {
    setSearchText(text);
  };

  useEffect(() => {
    fetchGlossaryTermAssets(selectedData as GlossaryTerm);
  }, [assetData.currPage]);

  useEffect(() => {
    fetchSearchedTerms();
  }, [searchText]);

  useEffect(() => {
    fetchGlossaryList();
  }, []);

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
          handleSelectedKey={handleSelectedKey}
          isChildLoading={isChildLoading}
          isGlossaryActive={isGlossaryActive}
          isHasAccess={!isAdminUser && !isAuthDisabled}
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
