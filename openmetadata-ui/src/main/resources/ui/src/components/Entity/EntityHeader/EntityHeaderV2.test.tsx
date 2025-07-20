/*
 *  Copyright 2025 Collate.
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
import { EntityHeaderV2 } from './EntityHeaderV2.component';

describe('EntityHeaderV2', () => {
  it('renders cover photo and entity name', () => {
    render(
      <EntityHeaderV2
        breadcrumb={[]}
        coverPhotoUrl="test-cover.jpg"
        entityData={{ name: 'TestEntity' }}
        entityType={EntityType.DOMAIN}
        icon={<span data-testid="icon">Icon</span>}
        serviceName=""
      />
    );

    expect(screen.getByAltText('cover')).toBeInTheDocument();
    expect(screen.getByText('TestEntity')).toBeInTheDocument();
  });
});
