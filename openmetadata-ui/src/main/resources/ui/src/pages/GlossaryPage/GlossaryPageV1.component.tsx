import { AxiosError, AxiosResponse } from 'axios';
import { compare } from 'fast-json-patch';
import { cloneDeep, extend } from 'lodash';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  getGlossaries,
  getGlossaryTerms,
  getGlossaryTermsByFQN,
  patchGlossaries,
  patchGlossaryTerm,
} from '../../axiosAPIs/glossaryAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import GlossaryV1 from '../../components/Glossary/GlossaryV1.component';
import Loader from '../../components/Loader/Loader';
import { getAddGlossaryTermsPath, ROUTES } from '../../constants/constants';
import { Glossary } from '../../generated/entity/data/glossary';
import { GlossaryTerm } from '../../generated/entity/data/glossaryTerm';
import useToastContext from '../../hooks/useToastContext';

export type ModifiedGlossaryData = Glossary & {
  children?: GlossaryTerm[];
};

const GlossaryPageV1 = () => {
  // const { glossaryName, glossaryTermsFQN } =
  // useParams<{ [key: string]: string }>();

  const history = useHistory();
  const showToast = useToastContext();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isChildLoading, setIsChildLoading] = useState(true);
  const [glossariesList, setGlossariesList] = useState<
    Array<ModifiedGlossaryData>
  >([]);
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [extendedKey, setExtendedKey] = useState<string[]>([]);
  const [selectedData, setSelectedData] = useState<Glossary | GlossaryTerm>();
  const [isGlossaryActive, setIsGlossaryActive] = useState(true);
  //   console.log(glossariesList);

  const handleChildLoading = (status: boolean) => {
    setIsChildLoading(status);
  };

  const fetchGlossaryTermsData = (id?: string) => {
    getGlossaryTerms(id, ['children', 'relatedTerms', 'reviewers', 'tags'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        const updatedData = data.filter((d: GlossaryTerm) => !d.parent);

        setGlossariesList((pre) => {
          return pre.map((d) =>
            d.id === id ? { ...d, children: updatedData } : d
          );
        });
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Error while fetching glossary terms!',
        });
      });
  };

  const fetchGlossaryList = (pagin = '') => {
    setIsLoading(true);
    getGlossaries(pagin, ['owner', 'tags'])
      .then((res: AxiosResponse) => {
        const { data } = res.data;
        if (data) {
          setGlossariesList(data);
          if (data.length) {
            setSelectedData(data[0]);
            setSelectedKey(data[0].name);
            fetchGlossaryTermsData(data[0].id);
          }
        }
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Something went wrong!',
        });
      })
      .finally(() => {
        setIsLoading(false);
        handleChildLoading(false);
      });
  };

  //   glossariesList[1].children[3].children[0] =res.data
  const fetchGlossaryTermsByName = (name: string, pos: string[]) => {
    getGlossaryTermsByFQN(name, [
      'children',
      'relatedTerms',
      'reviewers',
      'tags',
    ])
      .then((res: AxiosResponse) => {
        const clonedGlossaryList = cloneDeep(glossariesList);
        let treeNode = clonedGlossaryList[+pos[0]];
        for (let i = 1; i < pos.length; i++) {
          if (treeNode.children) {
            treeNode = treeNode.children[+pos[i]] as ModifiedGlossaryData;
          } else {
            break;
          }
        }

        extend(treeNode, res.data);

        setSelectedData(res.data);
        setGlossariesList(clonedGlossaryList);
        setIsGlossaryActive(false);
      })
      .catch((err: AxiosError) => {
        showToast({
          variant: 'error',
          body: err.message || 'Error while fetching glossary terms!',
        });
      })
      .finally(() => handleChildLoading(false));
  };

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
          body: err.message || 'Error while updating description!',
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
          body: err.message || 'Error while updating glossaryTerm!',
        });
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

  const handleExtendedKey = (key: string[]) => {
    setExtendedKey(key);
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
      fetchGlossaryTermsByName(
        (data as GlossaryTerm)?.fullyQualifiedName || data?.name,
        hierarchy
      );
    }
  };

  useEffect(() => {
    fetchGlossaryList();
  }, []);

  return (
    <PageContainerV1 className="tw-pt-4">
      {isLoading ? (
        <Loader />
      ) : (
        <GlossaryV1
          extendedKey={extendedKey}
          glossaryList={glossariesList as ModifiedGlossaryData[]}
          handleAddGlossaryClick={handleAddGlossaryClick}
          handleAddGlossaryTermClick={handleAddGlossaryTermClick}
          handleChildLoading={handleChildLoading}
          handleExtendedKey={handleExtendedKey}
          handleGlossaryTermUpdate={handleGlossaryTermUpdate}
          handleSelectedData={handleSelectedData}
          handleSelectedKey={handleSelectedKey}
          isChildLoading={isChildLoading}
          isGlossaryActive={isGlossaryActive}
          selectedData={selectedData as Glossary | GlossaryTerm}
          selectedKey={selectedKey}
          updateGlossary={updateGlossary}
        />
      )}
    </PageContainerV1>
  );
};

export default GlossaryPageV1;
