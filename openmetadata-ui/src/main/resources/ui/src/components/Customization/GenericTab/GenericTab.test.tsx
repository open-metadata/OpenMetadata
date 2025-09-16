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
import { useParams } from 'react-router-dom';
import { EntityTabs } from '../../../enums/entity.enum';
import { PageType } from '../../../generated/system/ui/page';
import { useGridLayoutDirection } from '../../../hooks/useGridLayoutDirection';
import { getWidgetsFromKey } from '../../../utils/CustomizePage/CustomizePageUtils';
import { GenericTab } from './GenericTab';

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockImplementation(() => ({ tab: EntityTabs.DETAILS })),
}));

jest.mock('../../../hooks/useGridLayoutDirection', () => ({
  useGridLayoutDirection: jest.fn(),
}));

jest.mock('../../../hooks/useCustomPages');

jest.mock('../../../utils/CustomizePage/CustomizePageUtils', () => ({
  getWidgetsFromKey: jest.fn(),
}));

describe('GenericTab', () => {
  beforeEach(() => {
    (useParams as jest.Mock).mockReturnValue({ tab: EntityTabs.DETAILS });
    (useGridLayoutDirection as jest.Mock).mockImplementation(() => ({
      direction: 'ltr',
    }));
    (getWidgetsFromKey as jest.Mock).mockReturnValue(<div>Mock Widget</div>);
  });

  it('should not render widget when getWidgetsFromKey returns null', () => {
    (getWidgetsFromKey as jest.Mock).mockReturnValue(null);

    render(<GenericTab type={PageType.Table} />);

    expect(screen.queryByText('Mock Widget')).not.toBeInTheDocument();
  });
});
