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

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import MUITable from "./DataGridX";

jest.mock("./DraggableMUIColumnItem/DraggableMUIColumnItem.component", () =>
  jest.fn().mockImplementation(({ currentItem, selectedOptions, onSelect }) => (
    <div key={currentItem.value}>
      <input
        checked={selectedOptions.includes(currentItem.value)}
        data-testid={`column-checkbox-${currentItem.value}`}
        type="checkbox"
        onChange={(e) => onSelect(currentItem.value, e.target.checked)}
      />
      <label>{currentItem.label}</label>
    </div>
  ))
);

const mockSetPreference = jest.fn();
const mockUseCurrentUserPreferences = {
  preferences: {
    selectedEntityTableColumns: {},
  },
  setPreference: mockSetPreference,
};

const mockColumns = [
  {
    field: "col1",
    headerName: "Column 1",
    width: 150,
  },
  {
    field: "col2",
    headerName: "Column 2",
    width: 150,
  },
  {
    field: "col3",
    headerName: "Column 3",
    width: 150,
  },
];

const mockData = [
  { id: 1, col1: "Value 1", col2: "Value 2", col3: "Value 3" },
  { id: 2, col1: "Value 4", col2: "Value 5", col3: "Value 6" },
];

describe("MUITable component", () => {
  const renderComponent = (props = {}) => {
    return render(
      <DndProvider backend={HTML5Backend}>
        <MUITable columns={mockColumns} rows={mockData} {...props} />
      </DndProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCurrentUserPreferences.preferences.selectedEntityTableColumns = {};
  });

  it("should not display loader if loading is false", () => {
    renderComponent({ loading: false });

    expect(screen.queryByTestId("loader")).not.toBeInTheDocument();
  });

  it("should render table with column dropdown when columns are provided", () => {
    renderComponent({
      staticVisibleColumns: ["col1"],
      defaultVisibleColumns: ["col2"],
    });

    expect(screen.getByTestId("column-dropdown")).toBeInTheDocument();
  });

  it("should render table filters when provided", () => {
    const extraTableFilters = <div data-testid="table-filters">Filters</div>;
    renderComponent({
      extraTableFilters,
    });

    expect(screen.getByTestId("table-filters")).toBeInTheDocument();
  });
});
