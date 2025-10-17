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
import { LabelType, State, TagSource } from '../../../generated/type/tagLabel';
import TierSection from './TierSection';

jest.mock('../TierCard/TierCard', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ children }) => (
      <div data-testid="tier-card">{children}</div>
    )),
}));

jest.mock('../../Tag/TagsV1/TagsV1.component', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue(<div>Tier Tag</div>),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe('TierSection', () => {
  it('should render tier section with tier', () => {
    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
        tier={{
          tagFQN: 'Tier.Tier1',
          labelType: LabelType.Manual,
          state: State.Confirmed,
          source: TagSource.Classification,
        }}
      />
    );

    expect(screen.getByText('label.tier')).toBeInTheDocument();
  });

  it('should render no data placeholder when tier is not provided', () => {
    render(
      <TierSection
        hasPermission
        entityId="test-id"
        entityType={EntityType.TABLE}
      />
    );

    expect(screen.getByText('label.tier')).toBeInTheDocument();
  });
});
