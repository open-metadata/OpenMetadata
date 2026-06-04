import type { HTMLAttributes } from 'react';

const sizes = {
  micro: {
    wh: 2,
    c: 1,
    r: 0.5,
  },
  tiny: {
    wh: 4,
    c: 2,
    r: 1,
  },
  xs: {
    wh: 6,
    c: 3,
    r: 2,
  },
  sm: {
    wh: 8,
    c: 4,
    r: 2.5,
  },
  md: {
    wh: 10,
    c: 5,
    r: 4,
  },
};

export const Dot = ({
  size = 'md',
  ...props
}: HTMLAttributes<HTMLOrSVGElement> & {
  size?: 'micro' | 'tiny' | 'sm' | 'md' | 'xs';
}) => {
  return (
    <svg
      fill="none"
      height={sizes[size].wh}
      viewBox={`0 0 ${sizes[size].wh} ${sizes[size].wh}`}
      width={sizes[size].wh}
      {...props}>
      <circle
        cx={sizes[size].c}
        cy={sizes[size].c}
        fill="currentColor"
        r={sizes[size].r}
        stroke="currentColor"
      />
    </svg>
  );
};
