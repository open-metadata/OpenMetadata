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
import { useEffect, useState } from 'react';
import type { ECElementEvent, MapSeriesOption } from 'echarts';
import * as echarts from 'echarts/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeoMapChart } from './geo-map-chart';
import type { ChartOption, GeoJson } from './types';

const hostProps = vi.hoisted(() => ({
  calls: [] as Array<Record<string, unknown>>,
}));

vi.mock('echarts-for-react/esm/core', () => ({
  default: (props: Record<string, unknown>) => {
    hostProps.calls.push(props);

    return <div data-testid="echarts-host" />;
  },
}));

const lastHost = () => hostProps.calls[hostProps.calls.length - 1];

const square = (name: string, x: number): GeoJson['features'][number] => ({
  type: 'Feature',
  properties: { name },
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [x, 0],
        [x + 1, 0],
        [x + 1, 1],
        [x, 1],
        [x, 0],
      ],
    ],
  },
});

const geoJson: GeoJson = {
  type: 'FeatureCollection',
  features: [square('Alpha', 0), square('Beta', 2)],
};

let mapCounter = 0;
const nextMapName = () => `test-map-${(mapCounter += 1)}`;

beforeEach(() => {
  hostProps.calls.length = 0;
});

describe('GeoMapChart', () => {
  it('registers the geometry under mapName before drawing it', () => {
    const mapName = nextMapName();
    render(
      <GeoMapChart
        ariaLabel="Map"
        data={[{ region: 'Alpha', value: 1 }]}
        geoJson={geoJson}
        mapName={mapName}
      />
    );
    const series = (lastHost().option as ChartOption)
      .series as MapSeriesOption[];

    expect(echarts.getMap(mapName)).toBeTruthy();
    expect(series[0].map).toBe(mapName);
  });

  it('registers a map name only once, even if new geometry is passed', () => {
    const mapName = nextMapName();
    const { rerender } = render(
      <GeoMapChart
        ariaLabel="Map"
        data={[{ region: 'Alpha', value: 1 }]}
        geoJson={geoJson}
        mapName={mapName}
      />
    );
    rerender(
      <GeoMapChart
        ariaLabel="Map"
        data={[{ region: 'Alpha', value: 2 }]}
        geoJson={{ ...geoJson, features: [square('Alpha', 0)] }}
        mapName={mapName}
      />
    );

    // Still the first, two-feature geometry.
    expect(
      (echarts.getMap(mapName) as { geoJSON: GeoJson }).geoJSON.features
    ).toHaveLength(2);
  });

  it('maps a clicked region back to its summed value', () => {
    const onRegionClick = vi.fn();
    render(
      <GeoMapChart
        ariaLabel="Map"
        data={[
          { region: 'A', value: 2 },
          { region: 'Alpha', value: 3 },
        ]}
        geoJson={geoJson}
        mapName={nextMapName()}
        resolveRegion={(raw) => (raw === 'A' ? 'Alpha' : raw)}
        onRegionClick={onRegionClick}
      />
    );
    const event = { name: 'Alpha' } as ECElementEvent;
    (lastHost().onEvents as Record<string, (e: ECElementEvent) => void>).click(
      event
    );

    expect(onRegionClick).toHaveBeenCalledWith(
      { region: 'Alpha', value: 5 },
      event
    );
  });

  it('ignores clicks on regions without data', () => {
    const onRegionClick = vi.fn();
    render(
      <GeoMapChart
        ariaLabel="Map"
        data={[{ region: 'Alpha', value: 1 }]}
        geoJson={geoJson}
        mapName={nextMapName()}
        onRegionClick={onRegionClick}
      />
    );
    (lastHost().onEvents as Record<string, (e: ECElementEvent) => void>).click({
      name: 'Beta',
    } as ECElementEvent);

    expect(onRegionClick).not.toHaveBeenCalled();
  });

  it('reports raw values that match no region', () => {
    const onUnmatchedRegions = vi.fn();
    render(
      <GeoMapChart
        ariaLabel="Map"
        data={[
          { region: 'Alpha', value: 1 },
          { region: 'ZZ', value: 1 },
        ]}
        geoJson={geoJson}
        mapName={nextMapName()}
        resolveRegion={(raw) => (raw === 'Alpha' ? raw : undefined)}
        onUnmatchedRegions={onUnmatchedRegions}
      />
    );

    expect(onUnmatchedRegions).toHaveBeenCalledWith(['ZZ']);
  });

  it('shows the empty state when no region matches', () => {
    render(
      <GeoMapChart
        ariaLabel="Map"
        data={[{ region: 'ZZ', value: 1 }]}
        geoJson={geoJson}
        mapName={nextMapName()}
        resolveRegion={() => undefined}
      />
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByTestId('echarts-host')).not.toBeInTheDocument();
  });

  it('reports unmatched values once per change, not on every parent render', () => {
    const reports: string[][] = [];
    const mapName = nextMapName();
    // A parent that passes fresh data, resolver and callback on every render
    // and stores what it is told — the wiring most callers will write.
    const Parent = ({ tick }: { tick: number }) => {
      const [, setUnmatched] = useState<string[]>([]);
      useEffect(() => undefined, [tick]);

      return (
        <GeoMapChart
          ariaLabel="Map"
          data={[
            { region: 'Alpha', value: 1 },
            { region: 'ZZ', value: tick },
          ]}
          geoJson={geoJson}
          mapName={mapName}
          resolveRegion={(raw) => (raw === 'Alpha' ? raw : undefined)}
          onUnmatchedRegions={(raw) => {
            reports.push(raw);
            setUnmatched(raw);
          }}
        />
      );
    };
    const { rerender } = render(<Parent tick={1} />);
    rerender(<Parent tick={2} />);
    rerender(<Parent tick={3} />);

    expect(reports).toEqual([['ZZ']]);
  });
});
