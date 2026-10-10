export const TOUR_STORAGE_KEY = 'flowpulse_tour_v1';

export type TourStep = {
  id: string;
  target?: string; // data-tour value
  title: string;
  body: string;
  placement?: 'auto' | 'right' | 'left' | 'bottom' | 'top';
};

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to FlowPulse',
    body: 'This console runs file pipelines end-to-end: ingest → validate → transform → load. This short tour shows what each area does and how to get started.',
  },
  {
    id: 'nav',
    target: 'sidebar',
    title: 'Navigation',
    body: 'Jump between Dashboard (health), Runs (history), Upload (start a pipeline), and Settings (API keys & system mode). Collapse the rail anytime to free space.',
    placement: 'right',
  },
  {
    id: 'header',
    target: 'page-header',
    title: 'Page context',
    body: 'Each screen has a short title and description so you always know where you are. Actions for the current page appear on the right.',
    placement: 'bottom',
  },
  {
    id: 'kpis',
    target: 'kpi-cards',
    title: 'Live KPIs',
    body: 'These cards summarize active runs, success rate, today’s files, duration, rows loaded, and dead letters. Click any card to jump to a filtered view.',
    placement: 'bottom',
  },
  {
    id: 'charts',
    target: 'analytics',
    title: 'Analytics',
    body: 'Charts show the last 7 days of runs, status mix, hourly throughput, and which workflows are busiest — so you can spot failures and load patterns quickly.',
    placement: 'top',
  },
  {
    id: 'activity',
    target: 'activity',
    title: 'Activity feed',
    body: 'Recent runs and system events appear here. Open a run to inspect each step’s status, timing, and output JSON.',
    placement: 'top',
  },
  {
    id: 'upload',
    target: 'upload-cta',
    title: 'How to get started',
    body: 'Click Upload file, pick a workflow (Order CSV or Product JSON), and submit a sample from fixtures/. The engine processes it immediately and updates this dashboard.',
    placement: 'left',
  },
  {
    id: 'results',
    title: 'Cleaned data tab',
    body: 'Open Cleaned data in the sidebar to browse loaded tables (e.g. orders_imported), inspect rows, and view simple charts of the cleaned output.',
  },
  {
    id: 'done',
    title: 'You’re ready',
    body: 'Demo API key is applied automatically in local mode. Re-open this tour anytime from the sidebar Product tour button. Happy piping!',
  },
];
