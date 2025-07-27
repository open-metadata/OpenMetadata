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
import { Col, Row } from 'antd';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FQN_SEPARATOR_CHAR } from '../../../../constants/char.constants';
import useCustomLocation from '../../../../hooks/useCustomLocation/useCustomLocation';
import { useFqn } from '../../../../hooks/useFqn';
import { getCustomizePagePath } from '../../../../utils/GlobalSettingsUtils';
import {
  getCustomizePageCategories,
  getCustomizePageOptions,
} from '../../../../utils/Persona/PersonaUtils';
import SettingItemCard from '../../SettingItemCard/SettingItemCard.component';

const categories = getCustomizePageCategories();

export const CustomizeUI = () => {
  const navigate = useNavigate();
  const location = useCustomLocation();
  const { fqn: personaFQN } = useFqn();
  const { activeCat, fullHash } = useMemo(() => {
    const activeCat =
      (location.hash?.replace('#', '') || '').split('.')[1] ?? '';

    return { activeCat, fullHash: location.hash?.replace('#', '') };
  }, [location.hash]);

  const [items, setItems] = useState(categories);

  const handleCustomizeItemClick = useCallback(
    (category: string) => {
      const nestedItems = getCustomizePageOptions(category);

      if (isEmpty(nestedItems)) {
        navigate(getCustomizePagePath(personaFQN, category));
      } else {
        navigate({
          hash: fullHash + FQN_SEPARATOR_CHAR + category,
        });
      }
    },
    [history, fullHash, personaFQN]
  );

  useEffect(() => {
    if (!activeCat) {
      setItems(categories);

      return;
    }

    const nestedItems = getCustomizePageOptions(activeCat);
    setItems(nestedItems);
  }, [activeCat]);

  return (
    <Row className="bg-grey" gutter={[16, 16]}>
      {items.map((value) => (
        <Col key={value.key} span={8}>
          <SettingItemCard data={value} onClick={handleCustomizeItemClick} />
        </Col>
      ))}
    </Row>
  );
};
