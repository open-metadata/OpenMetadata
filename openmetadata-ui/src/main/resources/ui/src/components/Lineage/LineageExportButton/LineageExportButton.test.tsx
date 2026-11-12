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
import { ExportTypes } from '../../../constants/Export.constants';
import LineageExportButton from './LineageExportButton';

const mockOnExportClick = jest.fn();

jest.mock('../../../context/LineageProvider/LineageProvider', () => ({
  useLineageProvider: () => ({ onExportClick: mockOnExportClick }),
}));

describe('LineageExportButton', () => {
  it('exports the graph the lineage provider holds as a PNG', () => {
    render(<LineageExportButton />);

    fireEvent.click(screen.getByTestId('export-button'));

    expect(mockOnExportClick).toHaveBeenCalledWith([ExportTypes.PNG]);
  });
});
