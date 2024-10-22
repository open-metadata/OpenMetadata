import { Button, Col, Row } from 'antd';
import { AxiosError } from 'axios';
import { cloneDeep } from 'lodash';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Loader from '../../components/common/Loader/Loader';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import { TreeTransfer } from '../../components/common/TreeTransfer/TreeTransfer';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import { TabSpecificField } from '../../enums/entity.enum';
import { Persona } from '../../generated/entity/teams/persona';
import { useFqn } from '../../hooks/useFqn';
import { getPersonaByName } from '../../rest/PersonaAPI';
import {
  filterAndArrangeTreeByKeys,
  getNestedKeys,
} from '../../utils/CustomizaNavigation/CustomizeNavigation';
import { getEntityName } from '../../utils/EntityUtils';
import leftSidebarClassBase from '../../utils/LeftSidebarClassBase';
import { getPersonaDetailsPath } from '../../utils/RouterUtils';
import { showErrorToast } from '../../utils/ToastUtils';
const sidebarOptions = leftSidebarClassBase.getSidebarItems().map((item) => ({
  ...item,
  title: item.label,
  children: item.children?.map((i) => ({ ...i, title: i.label })),
}));

export const SettingsNavigationPage = () => {
  const { fqn } = useFqn();
  const [isPersonaLoading, setIsPersonaLoading] = useState(true);
  const [personaDetails, setPersonaDetails] = useState<Persona | null>(null);
  const { t } = useTranslation();
  const [targetKeys, setTargetKeys] = useState<string[]>(
    getNestedKeys(sidebarOptions)
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
      const persona = await getPersonaByName(
        fqn,
        TabSpecificField.UI_CUSTOMIZATION
      );

      setPersonaDetails(persona);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsPersonaLoading(false);
    }
  };

  const handleSave = async () => {
    const navigationItems = filterAndArrangeTreeByKeys(
      cloneDeep(sidebarOptions),
      targetKeys
    );

    console.log(targetKeys, navigationItems);
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
        <Col push={1} span={4}>
          <Button type="primary" onClick={handleSave}>
            {t('label.save')}
          </Button>
        </Col>
        <Col span={24}>
          <TreeTransfer
            oneWay
            dataSource={sidebarOptions}
            render={(item) => item.title!}
            style={{ marginBottom: 16 }}
            targetKeys={targetKeys}
            onChange={handleChange}
          />
        </Col>
      </Row>
    </PageLayoutV1>
  );
};
