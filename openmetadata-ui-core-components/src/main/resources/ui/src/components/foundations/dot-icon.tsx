import type { HTMLAttributes } from 'react';

const sizes = {
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
}: HTMLAttributes<HTMLOrSVGElement> & { size?: 'sm' | 'md' }) => {
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
