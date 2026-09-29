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

import { fireEvent, render, screen } from '@testing-library/react';
import { ReactComponent as FileIcon } from '../../../assets/svg/common/file.svg';
import ContextKnowledgePillarCard from './ContextKnowledgePillarCard.component';
import { PillarRecentItem } from './ContextKnowledgePillarCard.interface';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const baseProps = {
  cta: 'View all',
  icon: FileIcon,
  stat: '5',
  statSub: 'items',
  subtitle: 'subtitle',
  title: 'Articles',
};

describe('ContextKnowledgePillarCard', () => {
  it('calls onClick when the card body is clicked', () => {
    const onClick = jest.fn();
    render(
      <ContextKnowledgePillarCard
        {...baseProps}
        dataTestId="article-detail-card"
        recent={[{ meta: [], onClick: jest.fn(), title: 'Item 1' }]}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByTestId('article-detail-card'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('calls the item onClick and not the card onClick when a recent item with onClick is clicked', () => {
    const onCardClick = jest.fn();
    const onItemClick = jest.fn();
    const recent: PillarRecentItem[] = [
      { meta: [], onClick: onItemClick, title: 'Item 1' },
    ];
    render(
      <ContextKnowledgePillarCard
        {...baseProps}
        dataTestId="article-detail-card"
        recent={recent}
        onClick={onCardClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Item 1' }));

    expect(onItemClick).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it('calls onClick when the CTA button is clicked, without double-firing from the card', () => {
    const onClick = jest.fn();
    render(
      <ContextKnowledgePillarCard
        {...baseProps}
        dataTestId="article-detail-card"
        recent={[{ meta: [], onClick: jest.fn(), title: 'Item 1' }]}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'View all' }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
