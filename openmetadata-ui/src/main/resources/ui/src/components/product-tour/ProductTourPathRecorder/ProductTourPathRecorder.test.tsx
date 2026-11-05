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
import ProductTourPathRecorder from './ProductTourPathRecorder';

const mockRecordPath = jest.fn();

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/explore', search: '?search=orders' }),
}));

jest.mock('../../../hooks/product-tour/useProductTourStore', () => ({
  useProductTourStore: (
    selector: (state: { recordPath: jest.Mock }) => unknown
  ) => selector({ recordPath: mockRecordPath }),
}));

describe('ProductTourPathRecorder', () => {
  it('records the current page, with its query, as where a tour would start', () => {
    render(<ProductTourPathRecorder />);

    expect(mockRecordPath).toHaveBeenCalledWith('/explore?search=orders');
  });
});
