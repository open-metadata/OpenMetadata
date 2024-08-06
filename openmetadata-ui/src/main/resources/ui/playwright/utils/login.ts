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
import { APIRequestContext } from '@playwright/test';

export const updateJWTTokenExpiryTime = async (
  apiContext: APIRequestContext,
  expiryTime: number
) => {
  await apiContext.put('/api/v1/system/settings', {
    data: {
      config_type: 'loginConfiguration',
      config_value: {
        maxLoginFailAttempts: 3,
        accessBlockTime: 600,
        jwtTokenExpiryTime: expiryTime,
      },
    },
  });
};
