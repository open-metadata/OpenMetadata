export const data = [
  {
    title: 'Usage Bot',
    message:
      'Harsha is running queries beyond the assigned benchmark. Please review the usage.',
    timestamp: '12:30 AM',
    quickReplies: [
      { text: 'Review Usage' },
      { text: 'Increse Bandwidth' },
      { text: 'Ignore' },
    ],
  },
  {
    title: 'Quality Bot',
    message:
      'fact_order table quality tests are failing since 6 hours. Please look at the tests.',
    timestamp: '12:30 AM',
    quickReplies: [{ text: 'Review Test' }, { text: 'assign' }],
  },
  {
    title: 'Suresh',
    message: 'Harsha can you please fix the failing test.',
    timestamp: '12:30 AM',
    subThreads: [
      {
        title: 'Harsha',
        message: 'Looking into it.',
        timestamp: '12:35 AM',
      },
      {
        title: 'Harsha',
        message: 'Suresh I’ve fixed the tests. Please review.',
        timestamp: '12:36 AM',
        quickReplies: [{ text: 'Review' }, { text: 'Ignore' }],
      },
    ],
  },
];

export const tasksData = [
  {
    description: 'Fact order freshness below SLA.',
    tag: 'p0',
  },
  {
    description: 'Updated description for dim_address.',
    tag: 'p1',
  },
  {
    description: 'Workflow generate fuel_metric is running slow.',
    tag: 'p0',
  },
  {
    description: 'Fact order freshness below SLA.',
    tag: 'p0',
  },
  {
    description: 'Updated description for dim_address.',
    tag: 'p1',
  },
  {
    description: 'Workflow generate fuel_metric is running slow.',
    tag: 'p2',
  },
];
