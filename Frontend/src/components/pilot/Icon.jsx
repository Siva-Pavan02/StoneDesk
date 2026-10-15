import { ArrowLeftIcon, ArrowRightIcon, BellIcon, CalendarIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, Cross2Icon, DashboardIcon, ExitIcon, FileTextIcon, HamburgerMenuIcon, HomeIcon, LayersIcon, LockClosedIcon, MagnifyingGlassIcon, MixerHorizontalIcon, PersonIcon, PlusIcon, ReaderIcon, SewingPinIcon, TrashIcon, UpdateIcon } from '@radix-ui/react-icons';

const icons = { menu: HamburgerMenuIcon, close: Cross2Icon, home: HomeIcon, loads: ReaderIcon, truck: DashboardIcon, bill: FileTextIcon, settings: MixerHorizontalIcon, search: MagnifyingGlassIcon, plus: PlusIcon, arrow: ArrowRightIcon, back: ArrowLeftIcon, prev: ChevronLeftIcon, next: ChevronRightIcon, check: CheckIcon, calendar: CalendarIcon, user: PersonIcon, bell: BellIcon, lock: LockClosedIcon, refresh: UpdateIcon, logout: ExitIcon, products: LayersIcon, places: SewingPinIcon, trash: TrashIcon };
export default function Icon({ name, className = '' }) {
  const Glyph = icons[name] || ReaderIcon;
  return <Glyph className={`h-5 w-5 shrink-0 ${className}`} aria-hidden="true" focusable="false" />;
}
