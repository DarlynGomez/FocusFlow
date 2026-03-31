import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function DashboardLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <main className="pl-14">
        <Outlet />
      </main>
    </div>
  );
}
