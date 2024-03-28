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
import { FC } from 'react';
import AuthenticatedAppRouter from '../components/AppRouter/AuthenticatedAppRouter';
import { ApplicationRoutesClassBase } from './ApplicationRoutesClassBase';

describe('ApplicationRoutesClassBase', () => {
  let applicationRoutesClassBase: ApplicationRoutesClassBase;

  beforeEach(() => {
    applicationRoutesClassBase = new ApplicationRoutesClassBase();
  });

  it('should return AuthenticatedAppRouter from getRouteElements', () => {
    const result: FC = applicationRoutesClassBase.getRouteElements();

    expect(result).toBe(AuthenticatedAppRouter);
  });
});
