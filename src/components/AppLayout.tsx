import { ReactNode, useState } from "react";
import { AppSidebar } from "./AppSidebar";
import { FloatingActionButton } from "./FloatingActionButton";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function AppLayout({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      {/* Mobile overlay backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 lg:hidden",
          mobileSidebarOpen ? "block" : "hidden"
        )}
        onClick={() => setMobileSidebarOpen(false)}
      />
      
      {/* Sidebar - desktop always visible, mobile as drawer */}
      <div
        className={cn(
          "sticky top-0 h-screen shrink-0 lg:w-[240px]",
          mobileSidebarOpen 
            ? "fixed left-0 top-0 z-50 w-[240px] animate-in slide-in-from-left" 
            : "hidden lg:block"
        )}
      >
        <AppSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
      </div>
      
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1120px] px-4 sm:px-8 py-8">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 reveal">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div>
                <div className="label-mono mb-1">Section</div>
                <h1 className="text-[24px] font-medium tracking-[-0.02em] text-foreground">
                  {title}
                </h1>
                {subtitle && (
                  <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
                )}
              </div>
            </div>
            {actions && <div className="flex items-center gap-2 ml-auto sm:ml-0">{actions}</div>}
          </header>
          <div className="reveal" style={{ animationDelay: "60ms" }}>
            {children}
          </div>
        </div>
      </main>
      <FloatingActionButton />
    </div>
  );
}