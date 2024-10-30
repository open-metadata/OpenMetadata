/*
 *  Copyright 2024 Collate.
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
import { Button, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { cloneDeep, isNil } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TreeTransfer } from '../../components/common/TreeTransfer/TreeTransfer';
import { LeftSidebarItem } from '../../components/MyData/LeftSidebar/LeftSidebar.interface';
import PageHeader from '../../components/PageHeader/PageHeader.component';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { Persona } from '../../generated/entity/teams/persona';
import { NavigationItem } from '../../generated/system/ui/uiCustomization';
import { useFqn } from '../../hooks/useFqn';
import { getPersonaByName } from '../../rest/PersonaAPI';
import {
  filterAndArrangeTreeByKeys,
  getNavigationItems,
  getNestedKeys,
  getNestedKeysFromNavigationItems,
} from '../../utils/CustomizaNavigation/CustomizeNavigation';
import { getEntityName } from '../../utils/EntityUtils';
import leftSidebarClassBase from '../../utils/LeftSidebarClassBase';
import { getPersonaDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
const sidebarOptions = leftSidebarClassBase.getSidebarItems();

interface Props {
  onSave: (navigationList: NavigationItem[]) => Promise<void>;
  currentNavigation?: NavigationItem[];
}

export const SettingsNavigationPage = ({
  onSave,
  currentNavigation,
}: Props) => {
  const { fqn } = useFqn();
  const [isPersonaLoading, setIsPersonaLoading] = useState(true);
  const [personaDetails, setPersonaDetails] = useState<Persona | null>(null);
  const { t } = useTranslation();
  const [saving, setSaving] = useState(false);
  const [targetKeys, setTargetKeys] = useState<string[]>(
    currentNavigation
      ? getNestedKeysFromNavigationItems(currentNavigation)
      : getNestedKeys(sidebarOptions)
  );

  const handleChange = (newTargetKeys: string[]) => {
    setTargetKeys(newTargetKeys);
  };

  const titleLinks = useMemo(
    () => [
      {
        name: 'Settings',
        url: '/settings',
      },
      ...(personaDetails
        ? [
            {
              name: getEntityName(personaDetails),
              url: getPersonaDetailsPath(fqn),
            },
          ]
        : []),
    ],
    [personaDetails?.name]
  );

  const fetchPersonaDetails = async () => {
    try {
      setIsPersonaLoading(true);
      const persona = await getPersonaByName(fqn);

      setPersonaDetails(persona);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPersonaLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    const navigationItems = getNavigationItems(
      filterAndArrangeTreeByKeys<LeftSidebarItem>(
        cloneDeep(sidebarOptions),
        targetKeys
      ).filter((t) => !isNil(t))
    );

    await onSave(navigationItems);
    setSaving(false);
  };

  useEffect(() => {
    fetchPersonaDetails();
  }, [fqn]);

  if (isPersonaLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle="Settings Navigation Page">
      <Row className="p-x-lg" gutter={[16, 16]}>
        <Col span={24}>
          <TitleBreadcrumb titleLinks={titleLinks} />
        </Col>
        <Col flex="auto">
          <PageHeader
            data={{
              header: 'Settings Navigation Page',
              subHeader: 'Settings Navigation Page',
            }}
          />
        </Col>
        <Col flex="80px">
          <Button loading={saving} type="primary" onClick={handleSave}>
            {t('label.save')}
          </Button>
        </Col>
        <Col span={24}>
          <TreeTransfer
            oneWay
            dataSource={sidebarOptions}
            style={{ marginBottom: 16 }}
            targetKeys={targetKeys}
            onChange={handleChange}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
