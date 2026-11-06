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
import { EntityType } from '../../../../enums/entity.enum';
import { DataAssetFiltersSection } from './DataAssetFiltersSection';

const queryBuilderProps = jest.fn();
jest.mock('./QueryBuilderSection', () => ({
  QueryBuilderSection: (props: Record<string, unknown>) => {
    queryBuilderProps(props);

    return <div data-testid="query-builder-section" />;
  },
}));

jest.mock('../../../../contexts/WorkflowModeContext', () => ({
  useWorkflowModeContext: jest.fn(() => ({ isFormDisabled: false })),
}));

const renderSection = (dataAsset: string) =>
  render(
    <DataAssetFiltersSection
      dataAssetFilters={[{ dataAsset, filters: '', id: 0 }]}
      dataAssets={[dataAsset]}
      onAddDataAssetFilter={jest.fn()}
      onRemoveDataAssetFilter={jest.fn()}
      onUpdateDataAssetFilter={jest.fn()}
    />
  );

describe('DataAssetFiltersSection', () => {
  // `dataAsset` already holds an EntityType, and those are camelCase. Lowering
  // them produced a key `getEntityTypeSearchIndexMapping` does not carry, so
  // the builder fell back to a generic field set for 24 of the asset types.
  it.each([
    EntityType.TABLE,
    EntityType.GLOSSARY_TERM,
    EntityType.DATABASE_SCHEMA,
  ])('should hand %s to the builder unchanged', (dataAsset) => {
    renderSection(dataAsset);

    expect(queryBuilderProps).toHaveBeenCalledWith(
      expect.objectContaining({ entityTypes: dataAsset })
    );
  });

  it('should title the card with the asset it filters', () => {
    renderSection(EntityType.GLOSSARY_TERM);

    expect(screen.getByText('GlossaryTerm')).toBeInTheDocument();
  });

  it('should render nothing without any data asset', () => {
    const { container } = render(
      <DataAssetFiltersSection
        dataAssetFilters={[]}
        dataAssets={[]}
        onAddDataAssetFilter={jest.fn()}
        onRemoveDataAssetFilter={jest.fn()}
        onUpdateDataAssetFilter={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
