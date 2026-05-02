import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import Dashboard from "./pages/Dashboard";
import MyExpenses from "./pages/MyExpenses";
import FixedExpenses from "./pages/FixedExpenses";
import AddCharge from "./pages/AddCharge";
import MySalary from "./pages/MySalary";
import MyWallet from "./pages/MyWallet";
import ExtraIncome from "./pages/ExtraIncome";
import Tables from "./pages/Tables";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login";

const queryClient = new QueryClient();

function AppRoutes() {
  const [session, setSession] = useState<boolean | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(!!session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (session === null) {
    return null;
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="/" element={<Dashboard />} />
      <Route path="/expenses" element={<MyExpenses />} />
      <Route path="/fixed" element={<FixedExpenses />} />
      <Route path="/cards/add" element={<AddCharge />} />
      <Route path="/salary" element={<MySalary />} />
      <Route path="/extra-income" element={<ExtraIncome />} />
      <Route path="/wallet" element={<MyWallet />} />
      <Route path="/categories" element={<Tables />} />
      <Route path="/tables" element={<Tables />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;