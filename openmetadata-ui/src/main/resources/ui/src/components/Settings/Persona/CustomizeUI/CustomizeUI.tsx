import { Col, Row } from 'antd';
import { isEmpty } from 'lodash';
import React from 'react';
import { useHistory } from 'react-router-dom';
import { useFqn } from '../../../../hooks/useFqn';
import { getCustomizePagePath } from '../../../../utils/GlobalSettingsUtils';
import {
  getCustomizePageCategories,
  getCustomizePageOptions,
} from '../../../../utils/Persona/PersonaUtils';
import SettingItemCard from '../../SettingItemCard/SettingItemCard.component';

const categories = getCustomizePageCategories();

export const CustomizeUI = () => {
  const history = useHistory();
  const { fqn: personaFQN } = useFqn();

  const [items, setItems] = React.useState(categories);

  const handleCustomizeItemClick = (category: string) => {
    const nestedItems = getCustomizePageOptions(category);

    if (isEmpty(nestedItems)) {
      history.push(getCustomizePagePath(personaFQN, category));
    } else {
      setItems(nestedItems);
    }
  };

  return (
    <Row gutter={[16, 16]}>
      {items.map((value) => (
        <Col key={value.key} span={8}>
          <SettingItemCard data={value} onClick={handleCustomizeItemClick} />
        </Col>
      ))}
    </Row>
  );
};
