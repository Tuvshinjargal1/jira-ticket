"use client";

import { useEffect, useState } from "react";
import {
  CalendarDays,
  ClipboardList,
  ListTodo,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Trophy,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

export type AppView = "tickets" | "mine" | "schedule" | "team";

type NavItem = { id: AppView; label: string; icon: LucideIcon; description: string };

export const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: "Ажил",
    items: [
      { id: "tickets", label: "Тикет", icon: ClipboardList, description: "DC project-ийн Jira ticket-үүдийг Planner руу sync хийх" },
      { id: "mine", label: "Миний ажил", icon: ListTodo, description: "Танд оноогдсон Planner task-ууд" },
      { id: "schedule", label: "Хуваарь", icon: CalendarDays, description: "Багийн Planner самбар, хугацаа" },
    ],
  },
  {
    title: "Баг",
    items: [
      { id: "team", label: "GP Arena", icon: Trophy, description: "Багийн статистик, character, kudos" },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items);

const COLLAPSE_KEY = "sidebar-collapsed";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

type Props = {
  view: AppView;
  onViewChange: (view: AppView) => void;
  account: { email: string; name: string } | null;
  counts?: Partial<Record<AppView, number>>;
};

function SidebarBody({
  view,
  onViewChange,
  account,
  counts,
  collapsed,
  onToggleCollapse,
  onNavigate,
}: Props & { collapsed: boolean; onToggleCollapse?: () => void; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      {/* Brand */}
      <div className={cn("flex h-16 items-center gap-3 px-4", collapsed && "justify-center px-0")}>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm">
          J→P
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">GP Workspace</div>
            <div className="truncate text-[11px] text-muted-foreground">DC project · GP team</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-3" aria-label="Үндсэн цэс">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            {collapsed ? (
              <div className="mx-auto mb-2 h-px w-6 bg-border" aria-hidden />
            ) : (
              <div className="mb-1.5 px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {section.title}
              </div>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
                const active = view === item.id;
                const count = counts?.[item.id];
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onViewChange(item.id);
                        onNavigate?.();
                      }}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "group relative flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        collapsed && "justify-center px-0",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                      )}
                    >
                      {active && (
                        <span className="absolute top-1.5 bottom-1.5 left-0 w-[3px] rounded-r-full bg-foreground" aria-hidden />
                      )}
                      <Icon className={cn("size-[18px] shrink-0", active && "text-foreground")} />
                      {!collapsed && <span className="flex-1 truncate text-left">{item.label}</span>}
                      {!collapsed && count !== undefined && count > 0 && (
                        <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums group-aria-[current=page]:bg-background">
                          {count}
                        </span>
                      )}
                      {collapsed && count !== undefined && count > 0 && (
                        <span className="absolute top-1 right-2 size-1.5 rounded-full bg-foreground/60" aria-hidden />
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="space-y-2 border-t p-3">
        {account && (
          <div className={cn("flex items-center gap-2.5 rounded-lg p-1.5", collapsed && "justify-center p-0")}>
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-xs font-semibold text-white"
              title={collapsed ? `${account.name} · ${account.email}` : undefined}
            >
              {initials(account.name)}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{account.name}</div>
                <div className="truncate text-[11px] text-muted-foreground">{account.email}</div>
              </div>
            )}
          </div>
        )}
        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <ThemeToggle />
          <form action="/api/auth/logout" method="post" className={cn(!collapsed && "flex-1")}>
            <button
              type="submit"
              title="Гарах"
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                collapsed ? "w-8 justify-center px-0" : "w-full"
              )}
            >
              <LogOut className="size-4" />
              {!collapsed && "Гарах"}
            </button>
          </form>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Цэс дэлгэх" : "Цэс хураах"}
              title={collapsed ? "Цэс дэлгэх" : "Цэс хураах"}
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Desktop: sticky хажуу багана (хураадаг). Mobile: дээд мөр + drawer. */
export function AppSidebar(props: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let stored = false;
    try {
      stored = window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      /* storage боломжгүй — default ашиглана */
    }
    if (stored) queueMicrotask(() => setCollapsed(true));
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      try {
        window.localStorage.setItem(COLLAPSE_KEY, prev ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !prev;
    });
  };

  const current = NAV_ITEMS.find((i) => i.id === props.view);

  return (
    <>
      {/* Desktop */}
      <aside
        className={cn(
          "sticky top-0 hidden h-dvh shrink-0 border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:block",
          collapsed ? "w-[68px]" : "w-64"
        )}
      >
        <SidebarBody {...props} collapsed={collapsed} onToggleCollapse={toggleCollapse} />
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-sidebar/90 px-4 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Цэс нээх"
          className="-ml-1.5 flex size-9 items-center justify-center rounded-lg hover:bg-sidebar-accent"
        >
          <Menu className="size-5" />
        </button>
        <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-[10px] font-bold text-primary-foreground">
          J→P
        </span>
        <span className="truncate text-sm font-semibold">{current?.label}</span>
      </div>

      {/* Mobile drawer */}
      <div
        className={cn("fixed inset-0 z-40 lg:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn("absolute inset-0 bg-black/40 transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r bg-sidebar shadow-2xl transition-transform duration-200",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          inert={!mobileOpen}
        >
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Цэс хаах"
            className="absolute top-4 right-3 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent"
          >
            <X className="size-4" />
          </button>
          <SidebarBody {...props} collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </aside>
      </div>
    </>
  );
}
