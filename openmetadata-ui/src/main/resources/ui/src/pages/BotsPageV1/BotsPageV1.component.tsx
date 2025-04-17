/*
 *  Copyright 2022 Collate.
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

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import BotListV1 from '../../components/Settings/Bot/BotListV1/BotListV1.component';
import { getCreateUserPath } from '../../utils/RouterUtils';

export const BotsPageV1 = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [showDeleted, setShowDeleted] = useState(false);

  const handleAddBotClick = () => {
    navigate(getCreateUserPath(true));
  };

  const handleShowDeleted = (checked: boolean) => {
    setShowDeleted(checked);
  };

  return (
    <PageLayoutV1
      pageTitle={t('label.entity-detail-plural', {
        entity: t('label.bot'),
      })}
      title="Table details">
      <BotListV1
        handleAddBotClick={handleAddBotClick}
        handleShowDeleted={handleShowDeleted}
        showDeleted={showDeleted}
      />
    </PageLayoutV1>
  );
};

export default BotsPageV1;
