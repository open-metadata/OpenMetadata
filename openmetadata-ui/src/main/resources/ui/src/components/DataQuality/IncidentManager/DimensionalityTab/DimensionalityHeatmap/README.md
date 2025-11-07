# Dimensionality Heatmap Component

This component displays test case results for different dimension values over time as a color-coded heatmap.

## Features

- **Heatmap Visualization**: Color-coded cells showing pass/fail/no-data status
- **Interactive Tooltips**: Hover over cells to see detailed information
- **Date Range Selection**: Filter data by date range
- **Dimension Selection**: View results for different dimensions
- **Responsive Grid Layout**: Uses CSS Grid for flexible layout

## Mock Data for Testing

To test the component without a working API, use the mock data:

### Enable Mock Data

In [DimensionalityTab.tsx](../DimensionalityTab.tsx), set:

```typescript
const USE_MOCK_DATA = true;
```

### Disable Mock Data (Use Real API)

```typescript
const USE_MOCK_DATA = false;
```

### Mock Data Configuration

The mock data generates random test results for these dimension values:
- Spain
- India
- USA
- France
- UK
- Others

The data distribution:
- 60% Success (green)
- 30% Failed (red)
- 10% Aborted/No data (gray)

### Customizing Mock Data

Edit [DimensionalityHeatmap.mock.ts](./DimensionalityHeatmap.mock.ts) to:

1. **Change dimension values**: Modify `MOCK_DIMENSION_VALUES` array
2. **Adjust status distribution**: Change the `random` thresholds in `generateMockDimensionResults`
3. **Modify data ranges**: Adjust `passedRows` and `failedRows` calculations

Example:

```typescript
export const MOCK_DIMENSION_VALUES = [
  'Region A',
  'Region B',
  'Region C',
];
```

## Color Legend

- 🟢 **Green (#10B981)**: Test passed
- 🔴 **Red (#EF4444)**: Test failed
- ⚪ **Gray (#E5E7EB)**: No data available

## Props

### DimensionalityHeatmapProps

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `DimensionResult[]` | Yes | Array of dimension test results |
| `startDate` | `number` | Yes | Start timestamp (milliseconds) |
| `endDate` | `number` | Yes | End timestamp (milliseconds) |
| `isLoading` | `boolean` | No | Loading state (default: false) |

## Usage Example

```tsx
import DimensionalityHeatmap from './DimensionalityHeatmap.component';

<DimensionalityHeatmap
  data={dimensionResults}
  startDate={startTs}
  endDate={endTs}
  isLoading={false}
/>
```

## Files

- `DimensionalityHeatmap.component.tsx` - Main component
- `DimensionalityHeatmap.interface.ts` - TypeScript interfaces
- `DimensionalityHeatmap.utils.ts` - Utility functions
- `DimensionalityHeatmap.less` - Styles
- `DimensionalityHeatmap.mock.ts` - Mock data generator
