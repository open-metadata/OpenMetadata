/*
 *  Copyright 2023 Collate.
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
import { ItemType, MenuItemType } from 'antd/lib/menu/hooks/useItems';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, {
  FC,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation } from 'react-i18next';
import {
  ACTIVE_DOMAIN_STORAGE_KEY,
  DEFAULT_DOMAIN_VALUE,
  PAGE_SIZE_LARGE,
} from '../../../constants/constants';
import { Domain } from '../../../generated/entity/domains/domain';
import { getDomainList } from '../../../rest/domainAPI';
import { getEntityName } from '../../../utils/EntityUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import { usePermissionProvider } from '../../PermissionProvider/PermissionProvider';
import { DomainContextType } from './DomainProvider.interface';

export const DomainContext = React.createContext({} as DomainContextType);

interface Props {
  children: ReactNode;
}

const DomainProvider: FC<Props> = ({ children }: Props) => {
  const { t } = useTranslation();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [domainLoading, setDomainLoading] = useState(false);
  const { permissions } = usePermissionProvider();
  const localStorageData =
    localStorage.getItem(ACTIVE_DOMAIN_STORAGE_KEY) ?? DEFAULT_DOMAIN_VALUE;

  const domainOptions = useMemo(() => {
    const options: ItemType[] = [
      {
        label: t('label.all-domain-plural'),
        key: DEFAULT_DOMAIN_VALUE,
      },
    ];
    domains.forEach((domain: Domain) => {
      options.push({
        label: getEntityName(domain),
        key: domain.fullyQualifiedName ?? '',
      });
    });

    return options;
  }, [domains]);

  const activeDomain = useMemo(() => {
    const activeDomainOption = domainOptions.find(
      (item) => item?.key === localStorageData
    );

    return (
      ((activeDomainOption as MenuItemType)?.label as string) ??
      localStorageData
    );
  }, [domainOptions]);

  const fetchDomainList = async () => {
    setDomainLoading(true);
    try {
      const { data } = await getDomainList({
        limit: PAGE_SIZE_LARGE,
      });
      setDomains(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setDomainLoading(false);
    }
  };

  const updateDomains = (domainsArr: Domain[]) => {
    setDomains(domainsArr);
  };

  const refreshDomains = () => {
    fetchDomainList();
  };

  const updateActiveDomain = (activeDomainKey: string) => {
    localStorage.setItem(ACTIVE_DOMAIN_STORAGE_KEY, activeDomainKey);
    refreshDomains();
  };

  const domainContextObj = useMemo(() => {
    return {
      domains,
      activeDomain,
      domainOptions,
      domainLoading,
      updateDomains,
      refreshDomains,
      updateActiveDomain,
    };
  }, [
    domains,
    activeDomain,
    domainOptions,
    domainLoading,
    updateDomains,
    refreshDomains,
  ]);

  useEffect(() => {
    if (!isEmpty(permissions)) {
      fetchDomainList();
    }
  }, [permissions]);

  return (
    <DomainContext.Provider value={domainContextObj}>
      {children}
    </DomainContext.Provider>
  );
};

export const useDomainProvider = () => useContext(DomainContext);

export default DomainProvider;
