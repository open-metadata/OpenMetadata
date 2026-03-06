import React from 'react';
import { Grid as AriaGrid } from 'react-aria-components';

const Grid = ({ columns = 24, gap, children }) => {
    const gridStyle = {
        display: 'grid',
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gap: gap,
    };

    return <AriaGrid style={gridStyle}>{children}</AriaGrid>;
};

Grid.Item = ({ span, start, children }) => {
    const itemStyle = {
        gridColumn: `${start} / span ${span}`,
    };

    return <div style={itemStyle}>{children}</div>;
};

export default Grid;