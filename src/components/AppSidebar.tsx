import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Repeat2,
  CreditCard,
  Wallet,
  Table as TableIcon,
  Sun,
  Moon,
  ChevronRight,
  ListChecks,
  TrendingUp,
  TrendingDown,
  Home,
  Settings,
  Sparkles,
  LogOut,
  X,
  type LucideIcon,
} from "lucide-react";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

type LeafItem = { to: string; label: string; icon: LucideIcon; end?: boolean };
type GroupItem = { label: string; icon: LucideIcon; children: LeafItem[] };

const directLinks: LeafItem[] = [
  { to: "/", label: "Home", icon: Home, end: true },
];

const groups: GroupItem[] = [
  {
    label: "Income",
    icon: TrendingUp,
    children: [
      { to: "/salary", label: "Salary", icon: Wallet },
      { to: "/extra-income", label: "Extra Income", icon: Sparkles },
    ],
  },
  {
    label: "Expenses",
    icon: TrendingDown,
    children: [
      { to: "/expenses", label: "Expenses", icon: ListChecks },
      { to: "/fixed", label: "Fixed Expenses", icon: Repeat2 },
      { to: "/cards/add", label: "Cards", icon: CreditCard },
    ],
  },
  {
    label: "Accounts",
    icon: Wallet,
    children: [
      { to: "/wallet", label: "Wallets", icon: Wallet },
    ],
  },
  {
    label: "Settings",
    icon: Settings,
    children: [
      { to: "/tables", label: "Manage", icon: TableIcon },
    ],
  },
];

function DirectNavItem({ item }: { item: LeafItem }) {
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive }) =>
          cn(
            "group flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent",
            isActive && "bg-sidebar-accent text-foreground"
          )
        }
      >
        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="flex-1">{item.label}</span>
      </NavLink>
    </li>
  );
}

function NavGroup({ group }: { group: GroupItem }) {
  const { pathname } = useLocation();
  const containsActive = group.children.some((c) => pathname === c.to || pathname.startsWith(c.to + "/"));
  const [open, setOpen] = useState(containsActive);
  const isOpen = open || containsActive;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent",
          containsActive && "text-foreground"
        )}
        aria-expanded={isOpen}
      >
        <group.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-90"
          )}
          strokeWidth={1.5}
        />
      </button>
      {isOpen && (
        <ul className="mt-0.5 flex flex-col gap-0.5 pl-4">
          {group.children.map((c) => (
            <li key={c.to}>
              <NavLink
                to={c.to}
                end={c.end}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-md px-3 py-1.5 text-[12.5px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
                    isActive && "bg-sidebar-accent text-foreground border-l-2 border-primary -ml-[2px] pl-[14px]"
                  )
                }
              >
                <c.icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span>{c.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

interface AppSidebarProps {
  onCloseMobile?: () => void;
}

export function AppSidebar({ onCloseMobile }: AppSidebarProps) {
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <aside className="flex h-screen max-h-screen w-[240px] flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar">
      <div className="flex items-center justify-between px-5 pb-6 pt-7">
        <div className="flex flex-col gap-1">
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
            Personal Ledger
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-[20px] font-medium tracking-tight text-foreground">Ledger</div>
            <div className="num text-[11px] text-muted-foreground">v1.0</div>
          </div>
        </div>
        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-2 -mr-2 text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3">
        <div className="label-mono mb-2 px-3">Navigate</div>
        <ul className="flex flex-col gap-0.5">
          {directLinks.map((item) => (
            <DirectNavItem key={item.to} item={item} />
          ))}
          {groups.map((g) => (
            <NavGroup key={g.label} group={g} />
          ))}
        </ul>
      </nav>

      <div className="border-t border-sidebar-border p-3 space-y-1">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[12px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Sign out"
        >
          <span className="font-mono uppercase tracking-[0.06em]">Sign out</span>
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
        </button>
        <button
          onClick={toggle}
          className="flex w-full items-center justify-between rounded-md px-3 py-2 text-[12px] text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          aria-label="Toggle theme"
        >
          <span className="font-mono uppercase tracking-[0.06em]">
            {theme === "dark" ? "Dark" : "Light"} mode
          </span>
          {theme === "dark" ? (
            <Moon className="h-4 w-4" strokeWidth={1.5} />
          ) : (
            <Sun className="h-4 w-4" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </aside>
  );
}
