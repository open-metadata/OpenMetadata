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

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getAlertsFromId } from '../../axiosAPIs/alertsAPI';
import PageContainerV1 from '../../components/containers/PageContainerV1';
import { Alerts } from '../../generated/alerts/alerts';
import { showErrorToast } from '../../utils/ToastUtils';

const AlertDetailsPage = () => {
  const { fqn } = useParams<{ fqn: string }>();
  const [alert, setAlert] = useState<Alerts>();

  const fetchAlert = useCallback(async () => {
    if (fqn) {
      try {
        const response = await getAlertsFromId(fqn);
        setAlert(response);
      } catch (error) {
        showErrorToast(`Couldn't find alert with given fqn`);
      }
    }
  }, [fqn]);

  useEffect(() => {
    fetchAlert();
  }, [fqn]);

  return (
    <PageContainerV1>
      AlertDetailsPage
      <h4>{fqn}</h4>
      <p>{alert?.name}</p>
    </PageContainerV1>
  );
};

export default AlertDetailsPage;
