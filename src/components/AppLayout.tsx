import { ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { ReminderBell } from "./ReminderBell";
import { ReminderAutoPopup } from "./ReminderAutoPopup";

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
  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
      <div className="sticky top-0 h-screen shrink-0">
        <AppSidebar />
      </div>
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto w-full max-w-[1120px] px-8 py-8">
          <header className="mb-8 flex items-end justify-between gap-4 reveal">
            <div>
              <div className="label-mono mb-1">Section</div>
              <h1 className="text-[24px] font-medium tracking-[-0.02em] text-foreground">
                {title}
              </h1>
              {subtitle && (
                <p className="mt-1 text-[13px] text-muted-foreground">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </header>
          <div className="reveal" style={{ animationDelay: "60ms" }}>
            {children}
          </div>
        </div>
      </main>
      <ReminderBell />
      <ReminderAutoPopup />
    </div>
  );
}
