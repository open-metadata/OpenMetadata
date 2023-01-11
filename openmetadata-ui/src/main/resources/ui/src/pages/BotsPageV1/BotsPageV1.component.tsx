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

import BotListV1 from 'components/BotListV1/BotListV1.component';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getCreateUserPath } from '../../constants/constants';

export const BotsPageV1 = () => {
  const history = useHistory();
  const [showDeleted, setShowDeleted] = useState(false);

  const handleAddBotClick = () => {
    history.push(getCreateUserPath(true));
  };

  const handleShowDeleted = (checked: boolean) => {
    setShowDeleted(checked);
  };

  return (
    <BotListV1
      handleAddBotClick={handleAddBotClick}
      handleShowDeleted={handleShowDeleted}
      showDeleted={showDeleted}
    />
  );
};

export default BotsPageV1;
