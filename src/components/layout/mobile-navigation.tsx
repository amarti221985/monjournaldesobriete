import { NavLink } from "@/components/layout/nav-link";
import { primaryNavigation } from "@/config/navigation";

/** Barre de navigation inférieure, visible sous le breakpoint lg. */
export function MobileNavigation() {
  return (
    <nav
      aria-label="Navigation principale"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-2">
        {primaryNavigation.map((item) => (
          <li key={item.href} className="flex min-w-0 flex-1">
            <NavLink
              item={{ label: item.label, shortLabel: item.shortLabel, href: item.href, available: item.available }}
              icon={<item.icon className="size-5" aria-hidden="true" />}
              variant="bottom-bar"
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}
