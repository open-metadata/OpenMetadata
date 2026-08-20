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
import { EntityType } from '../../../../../enums/entity.enum';
import { ContextSection } from '../../../../../generated/type/personaContextDefinition';
import { ContextRuleCard } from './ContextRuleCard.component';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe('ContextRuleCard', () => {
  it('renders knowledge rules as fully rendered and hides edit actions', () => {
    render(
      <ContextRuleCard
        canEdit={false}
        rule={{
          alwaysInContext: true,
          entityType: EntityType.KNOWLEDGE_PAGE,
          fullyRendered: true,
          name: 'Analytics articles',
        }}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByText('label.fully-rendered')).toBeInTheDocument();
    expect(screen.getByText('label.always-in-context')).toBeInTheDocument();
    expect(screen.queryByLabelText('label.edit')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('label.delete')).not.toBeInTheDocument();
  });

  it('renders selected asset sections and edit actions', () => {
    render(
      <ContextRuleCard
        canEdit
        matched={12}
        rule={{
          entityType: EntityType.TABLE,
          name: 'Semantic tables',
          sections: [ContextSection.Schema, ContextSection.Profile],
        }}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />
    );

    expect(screen.getByText('label.schema')).toBeInTheDocument();
    expect(screen.getByText('label.profile')).toBeInTheDocument();
    expect(screen.getByText('label.heavy')).toBeInTheDocument();
    expect(screen.getByLabelText('label.edit')).toBeInTheDocument();
    expect(screen.getByLabelText('label.delete')).toBeInTheDocument();
  });
});
