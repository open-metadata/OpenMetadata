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
import { render } from '@testing-library/react';
import ProductTourPage from './ProductTourPage';

const mockStart = jest.fn();
const mockDocumentTitle = jest.fn();

jest.mock('../../../hooks/product-tour/useProductTourStore', () => ({
  useProductTourStore: (selector: (state: { start: jest.Mock }) => unknown) =>
    selector({ start: mockStart }),
}));

jest.mock('../../../hooks/useAppMode', () => ({
  useAppMode: () => 'default',
}));

jest.mock('../../../components/common/DocumentTitle/DocumentTitle', () =>
  jest.fn().mockImplementation((props: { title: string }) => {
    mockDocumentTitle(props);

    return null;
  })
);

describe('ProductTourPage', () => {
  it('starts the tour for the mode the user is in, showing nothing itself', () => {
    const { container } = render(<ProductTourPage />);

    expect(mockStart).toHaveBeenCalledWith('default');
    expect(container).toBeEmptyDOMElement();
  });

  it('titles the tab while the tour takes over /tour', () => {
    render(<ProductTourPage />);

    expect(mockDocumentTitle).toHaveBeenCalledWith({ title: 'label.tour' });
  });
});
