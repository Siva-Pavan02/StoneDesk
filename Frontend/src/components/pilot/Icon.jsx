import { ArrowRightIcon, BellIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, Cross2Icon, DashboardIcon, FileTextIcon, HamburgerMenuIcon, HomeIcon, LockClosedIcon, MagnifyingGlassIcon, MixerHorizontalIcon, PersonIcon, PlusIcon, ReaderIcon, UpdateIcon } from '@radix-ui/react-icons';

const icons = { menu: HamburgerMenuIcon, close: Cross2Icon, home: HomeIcon, loads: ReaderIcon, truck: DashboardIcon, bill: FileTextIcon, settings: MixerHorizontalIcon, search: MagnifyingGlassIcon, plus: PlusIcon, arrow: ArrowRightIcon, prev: ChevronLeftIcon, next: ChevronRightIcon, check: CheckIcon, user: PersonIcon, bell: BellIcon, lock: LockClosedIcon, refresh: UpdateIcon };
export default function Icon({ name, className = '' }) {
  const Glyph = icons[name] || ReaderIcon;
  return <Glyph className={`h-5 w-5 shrink-0 ${className}`} aria-hidden="true" focusable="false" />;
}
