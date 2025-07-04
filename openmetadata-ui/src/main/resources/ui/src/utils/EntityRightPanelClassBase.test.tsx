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
import { render, screen } from '@testing-library/react';
import { FC } from 'react';
import entityRightPanelClassBase, {
  EntityRightPanelClassBase,
} from './EntityRightPanelClassBase';

describe('EntityRightPanelClassBase', () => {
  let instance: EntityRightPanelClassBase;

  beforeEach(() => {
    instance = new EntityRightPanelClassBase();
  });

  it('should create an instance of EntityRightPanelClassBase', () => {
    expect(instance).toBeInstanceOf(EntityRightPanelClassBase);
  });

  it('should return null from getKnowLedgeArticlesWidget method', () => {
    const widget: FC<{ entityId: string; entityType: string }> | null =
      instance.getKnowLedgeArticlesWidget();

    expect(widget).toBeNull();
  });

  it('should return a valid React component when getKnowLedgeArticlesWidget is not null', () => {
    // Mock the getKnowLedgeArticlesWidget method to return a KnowLedgeArticles component
    instance.getKnowLedgeArticlesWidget = () => () =>
      <div data-testid="KnowLedgeArticles" />;

    const Widget = instance.getKnowLedgeArticlesWidget();
    if (Widget) {
      render(<Widget entityId="test" entityType="test" />);
    }

    expect(screen.queryByTestId('KnowLedgeArticles')).toBeInTheDocument();
  });
});

describe('entityRightPanelClassBase', () => {
  it('should be an instance of EntityRightPanelClassBase', () => {
    expect(entityRightPanelClassBase).toBeInstanceOf(EntityRightPanelClassBase);
  });
});
