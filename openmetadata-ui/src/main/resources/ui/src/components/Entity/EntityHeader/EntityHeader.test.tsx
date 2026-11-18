/*
 *  Copyright 2026 Collate.
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
import { render, screen } from '@testing-library/react';
import { EntityType } from '../../../enums/entity.enum';
import { EntityHeader } from './EntityHeader.component';

jest.mock('../EntityHeaderTitle/EntityHeaderTitle.component', () =>
  jest.fn(({ entityType }) => <div>{entityType}</div>)
);

jest.mock('../../common/TitleBreadcrumb/TitleBreadcrumb.component', () =>
  jest.fn(() => null)
);

describe('EntityHeader', () => {
  it.each([EntityType.DOMAIN, EntityType.DATA_PRODUCT])(
    'passes entityType %s to the title so the follow tooltip names it',
    (entityType) => {
      render(
        <EntityHeader
          breadcrumb={[]}
          entityData={{ name: 'test' }}
          entityType={entityType}
          icon={null}
          serviceName=""
        />
      );

      expect(screen.getByText(entityType)).toBeInTheDocument();
    }
  );
});
