import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { DriverGuard } from "@/components/guards/DriverGuard";
import { AdminGuard } from "@/components/guards/AdminGuard";
import { AdminShell } from "@/components/layout/AdminShell";

const Landing = lazy(() => import("@/pages/Landing"));
const DriverLogin = lazy(() => import("@/pages/driver/Login"));
const DriverMenu = lazy(() => import("@/pages/driver/Menu"));
const DriverStartSelect = lazy(() => import("@/pages/driver/StartVehicle/Select"));
const DriverStartBlueprint = lazy(() => import("@/pages/driver/StartVehicle/Blueprint"));
const DriverStartPreTrip = lazy(() => import("@/pages/driver/StartVehicle/PreTrip"));
const DriverReturnInspection = lazy(() => import("@/pages/driver/ReturnVehicle/Inspection"));
const AdminLogin = lazy(() => import("@/pages/admin/Login"));
const AdminDashboard = lazy(() => import("@/pages/admin/Dashboard"));
const AdminDrivers = lazy(() => import("@/pages/admin/Drivers/List"));
const AdminDriverDetail = lazy(() => import("@/pages/admin/Drivers/Detail"));
const AdminVehicles = lazy(() => import("@/pages/admin/Vehicles/List"));
const AdminVehicleBlueprint = lazy(() => import("@/pages/admin/Vehicles/Blueprint"));
const AdminVehicleDetail = lazy(() => import("@/pages/admin/Vehicles/Detail"));
const AdminSessions = lazy(() => import("@/pages/admin/Sessions"));
const AdminSessionReport = lazy(() => import("@/pages/admin/Sessions/Report"));
const AdminInspections = lazy(() => import("@/pages/admin/Inspections"));
const AdminDamages = lazy(() => import("@/pages/admin/Damages"));
const AdminReports = lazy(() => import("@/pages/admin/Reports"));
const AdminChecklists = lazy(() => import("@/pages/admin/Checklists"));

function PageLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-muted border-t-primary" />
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/" element={<Landing />} />

        <Route path="/driver/login" element={<DriverLogin />} />
        <Route element={<DriverGuard />}>
          <Route path="/driver" element={<DriverMenu />} />
          <Route path="/driver/start" element={<DriverStartSelect />} />
          <Route path="/driver/start/:vehicleId/blueprint" element={<DriverStartBlueprint />} />
          <Route path="/driver/start/:vehicleId/pretrip" element={<DriverStartPreTrip />} />
          <Route path="/driver/return" element={<DriverReturnInspection />} />
        </Route>

        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminGuard />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/drivers" element={<AdminDrivers />} />
            <Route path="/admin/drivers/:driverId" element={<AdminDriverDetail />} />
            <Route path="/admin/vehicles" element={<AdminVehicles />} />
            <Route path="/admin/vehicles/:vehicleId" element={<AdminVehicleDetail />} />
            <Route path="/admin/vehicles/:vehicleId/blueprint" element={<AdminVehicleBlueprint />} />
            <Route path="/admin/checklists" element={<AdminChecklists />} />
            <Route path="/admin/sessions" element={<AdminSessions />} />
            <Route path="/admin/sessions/:sessionId" element={<AdminSessionReport />} />
            <Route path="/admin/inspections" element={<AdminInspections />} />
            <Route path="/admin/damages" element={<AdminDamages />} />
            <Route path="/admin/reports" element={<AdminReports />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
