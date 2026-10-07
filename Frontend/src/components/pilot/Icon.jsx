const paths = {
  menu: 'M4 6h16M4 12h16M4 18h16', close: 'm6 6 12 12M18 6 6 18',
  home: 'm3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7',
  loads: 'M5 3h14v18H5V3Zm3 5h8M8 12h8M8 16h5',
  truck: 'M3 5h11v12H3V5Zm11 5h4l3 4v3h-7M6 17a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm12 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  bill: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6M9 12h6',
  settings: 'M4 7h16M4 17h16M8 4v6M16 14v6',
  search: 'M10 3a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm5 12 6 6',
  plus: 'M12 4v16M4 12h16', arrow: 'M4 12h16m-6-6 6 6-6 6',
  check: 'm5 12 4 4L19 6', user: 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21v-2a8 8 0 0 1 16 0v2',
  bell: 'M6 8a6 6 0 0 1 12 0v7l2 3H4l2-3V8Zm4 13h4',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v11H5V10Zm7 4v3',
  refresh: 'M20 7A9 9 0 1 0 21 14M20 2v5h-5',
};
export default function Icon({ name, className = '' }) {
  return <svg className={`h-5 w-5 shrink-0 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.loads} /></svg>;
}
