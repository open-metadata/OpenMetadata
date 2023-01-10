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

import { AxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { checkAirflowStatus } from 'rest/ingestionPipelineAPI';

interface UseAirflowStatusProps {
  isFetchingStatus: boolean;
  isAirflowAvailable: boolean;
  error: AxiosError | undefined;
  fetchAirflowStatus: () => Promise<void>;
}

export const useAirflowStatus = (): UseAirflowStatusProps => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAirflowAvailable, setIsAirflowAvailable] = useState<boolean>(false);
  const [error, setError] = useState<AxiosError>();

  const fetchAirflowStatus = async () => {
    setIsLoading(true);
    try {
      const response = await checkAirflowStatus();
      setIsAirflowAvailable(response.status === 200);
    } catch (error) {
      setError(error as AxiosError);
      setIsAirflowAvailable(false);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAirflowStatus();
  }, []);

  return {
    isFetchingStatus: isLoading,
    isAirflowAvailable,
    error,
    fetchAirflowStatus,
  };
};
