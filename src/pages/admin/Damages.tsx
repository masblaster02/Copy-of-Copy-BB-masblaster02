import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/lib/supabase";
import { getSignedUrl, getPublicUrl } from "@/lib/storage";
import { toast } from "sonner";
import { TriangleAlert as AlertTriangle, CircleCheck as CheckCircle2, Circle as XCircle, Clock, Eye, SquareCheck as CheckSquare, MapPin, Car, User, Calendar, MessageSquare, Search, X } from "lucide-react";
import { VehicleBlueprint, type BlueprintMarker, type BlueprintView } from "@/components/VehicleBlueprint";

const STATUSES = ["open", "in_review", "repaired"];

interface DamageMarker {
  id: string;
  reported_at: string;
  damage_type: string;
  description: string | null;
  status: string;
  view: BlueprintView;
  x_coordinate: number;
  y_coordinate: number;
  source: "baseline" | "driver";
  reported_during: "pre_trip" | "return" | null;
  session_id: string | null;
  approved: boolean;
  approved_at: string | null;
  rejection_reason: string | null;
  vehicle_id: string;
  driver_id: string | null;
  vehicle: { registration_number: string; make: string; model: string } | null;
  driver: { name: string; surname: string; employee_number: string } | null;
}

export default function AdminDamages() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<string>("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<"pending" | "all" | "pre_trip" | "return">("pending");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery<DamageMarker[]>({
    queryKey: ["admin-damages", filter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("damage_markers")
        .select(
          "id, reported_at, damage_type, description, status, view, x_coordinate, y_coordinate, source, reported_during, session_id, approved, approved_at, rejection_reason, vehicle_id, driver_id, vehicle:vehicles(registration_number, make, model), driver:drivers(name, surname, employee_number)"
        )
        .order("reported_at", { ascending: false })
        .limit(500);
      if (filter !== "all") q = q.eq("status", filter);
      if (dateFrom) q = q.gte("reported_at", dateFrom);
      if (dateTo) q = q.lte("reported_at", dateTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const applySearch = (list: DamageMarker[]) => {
    if (!search) return list;
    const t = search.toLowerCase();
    return list.filter(
      (d) =>
        d.vehicle?.registration_number?.toLowerCase().includes(t) ||
        d.vehicle?.make?.toLowerCase().includes(t) ||
        d.vehicle?.model?.toLowerCase().includes(t) ||
        d.driver?.name?.toLowerCase().includes(t) ||
        d.driver?.surname?.toLowerCase().includes(t) ||
        d.description?.toLowerCase().includes(t)
    );
  };

  const pendingDamages = applySearch((data || []).filter((d) => d.source === "driver" && !d.approved));
  const preTripDamages = applySearch((data || []).filter((d) => d.reported_during === "pre_trip"));
  const returnDamages = applySearch((data || []).filter((d) => d.reported_during === "return"));
  const allDamages = applySearch(data || []);

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setFilter("all");
  }

  const hasFilters = search || dateFrom || dateTo || filter !== "all";

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("damage_markers").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin-damages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approve = useMutation({
    mutationFn: async ({ id, approve: approved, reason }: { id: string; approve: boolean; reason?: string }) => {
      const update = approved
        ? { approved: true, approved_at: new Date().toISOString(), status: "open" }
        : { approved: true, approved_at: new Date().toISOString(), status: "closed", rejection_reason: reason || "Rejected by admin" };
      const { error } = await supabase.from("damage_markers").update(update).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-damages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const bulkApprove = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase
        .from("damage_markers")
        .update({ approved: true, approved_at: new Date().toISOString(), status: "open" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("All selected approved");
      setSelectedIds(new Set());
      qc.invalidateQueries({ queryKey: ["admin-damages"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  }

  function selectAllPending() {
    setSelectedIds(new Set(pendingDamages.map((d) => d.id)));
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Damages</h1>
          <p className="text-sm text-muted-foreground">Track reported damage and repair status</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
                {s.replace("_", " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Search & date filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vehicle, driver, or description…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="w-40"
          title="From date"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="w-40"
          title="To date"
        />
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="mr-1 h-4 w-4" /> Clear
          </Button>
        )}
      </div>

      {/* Pending Approval Alert */}
      {pendingDamages.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-amber-500/20 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  {pendingDamages.length} damage report{pendingDamages.length !== 1 ? "s" : ""} pending approval
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Review driver-submitted damage reports before they become visible in the fleet
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <Button variant="outline" size="sm" onClick={() => bulkApprove.mutate(Array.from(selectedIds))}>
                  <CheckSquare className="mr-1 h-4 w-4" />
                  Approve {selectedIds.size} selected
                </Button>
              )}
              {selectedIds.size === pendingDamages.length ? (
                <Button variant="outline" size="sm" onClick={clearSelection}>
                  Clear
                </Button>
              ) : (
                <Button variant="outline" size="sm" onClick={selectAllPending}>
                  Select all
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as "pending" | "all" | "pre_trip" | "return")}>
        <TabsList>
          <TabsTrigger value="pending" className="relative">
            Pending Approval
            {pendingDamages.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-xs text-white">
                {pendingDamages.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="all">All Damages</TabsTrigger>
          <TabsTrigger value="pre_trip">
            Pre-trip
            {preTripDamages.length > 0 && (
              <span className="ml-1.5 rounded-full bg-blue-500 px-1.5 text-xs text-white">
                {preTripDamages.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="return">
            Return
            {returnDamages.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-600 px-1.5 text-xs text-white">
                {returnDamages.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          {pendingDamages.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
              <p className="mt-4 font-medium">All caught up!</p>
              <p className="text-sm text-muted-foreground">No damage reports pending approval</p>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedIds.size === pendingDamages.length && pendingDamages.length > 0}
                        onCheckedChange={(checked) => checked ? selectAllPending() : clearSelection()}
                      />
                    </TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Type / Location</TableHead>
                    <TableHead>Reported by</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingDamages.map((d) => (
                    <TableRow key={d.id} className={selectedIds.has(d.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(d.id)}
                          onCheckedChange={() => toggleSelect(d.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {new Date(d.reported_at).toLocaleDateString()}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {new Date(d.reported_at).toLocaleTimeString()}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Link to={`/admin/vehicles/${d.vehicle_id}`} className="group">
                          <div className="flex items-center gap-2 group-hover:text-primary transition-colors">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium underline-offset-4 group-hover:underline">{d.vehicle?.registration_number}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {d.vehicle?.make} {d.vehicle?.model}
                          </p>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="capitalize">
                            {d.damage_type.replace("_", " ")}
                          </Badge>
                          <span className="text-xs text-muted-foreground capitalize">{d.view}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          ({d.x_coordinate.toFixed(0)}, {d.y_coordinate.toFixed(0)})
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {d.driver?.name} {d.driver?.surname}
                        </div>
                        <p className="text-xs text-muted-foreground">{d.driver?.employee_number}</p>
                        <div className="mt-1">
                          <ReportedDuringBadge value={d.reported_during} source={d.source} />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="ghost" onClick={() => setSelected(d.id)}>
                            <Eye className="mr-1 h-4 w-4" /> Review
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => approve.mutate({ id: d.id, approve: true })}
                          >
                            <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <AllDamagesTable damages={allDamages} onSelect={setSelected} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} />
        </TabsContent>

        <TabsContent value="pre_trip" className="mt-4">
          {preTripDamages.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No pre-trip damages</p>
              <p className="text-sm text-muted-foreground">No damage was reported during pre-trip inspections</p>
            </Card>
          ) : (
            <AllDamagesTable damages={preTripDamages} onSelect={setSelected} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} />
          )}
        </TabsContent>

        <TabsContent value="return" className="mt-4">
          {returnDamages.length === 0 ? (
            <Card className="p-8 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 font-medium">No return damages</p>
              <p className="text-sm text-muted-foreground">No damage was reported during vehicle returns</p>
            </Card>
          ) : (
            <AllDamagesTable damages={returnDamages} onSelect={setSelected} onStatusChange={(id, status) => updateStatus.mutate({ id, status })} />
          )}
        </TabsContent>
      </Tabs>

      <DamageDetailDrawer id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function AllDamagesTable({
  damages,
  onSelect,
  onStatusChange,
}: {
  damages: DamageMarker[];
  onSelect: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  return (
    <Card>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Reported</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Type / View</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Source</TableHead>
            <TableHead>Reported by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {damages.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{new Date(d.reported_at).toLocaleString()}</TableCell>
              <TableCell>
                <Link
                  to={`/admin/vehicles/${d.vehicle_id}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {d.vehicle?.registration_number}
                </Link>
              </TableCell>
              <TableCell className="capitalize">
                {d.damage_type} <span className="text-xs text-muted-foreground">/ {d.view}</span>
              </TableCell>
              <TableCell>
                <ReportedDuringBadge value={d.reported_during} source={d.source} />
              </TableCell>
              <TableCell>
                <Badge variant={d.source === "baseline" ? "secondary" : d.approved ? "default" : "outline"}>
                  {d.source === "baseline" ? "Baseline" : d.approved ? "Driver (Approved)" : "Driver (Pending)"}
                </Badge>
              </TableCell>
              <TableCell>
                {d.driver?.name} {d.driver?.surname}
              </TableCell>
              <TableCell>
                <Select value={d.status} onValueChange={(v) => onStatusChange(d.id, v)}>
                  <SelectTrigger className="h-7 w-32 text-xs">
                    <Badge variant="outline" className="capitalize">
                      {d.status.replace("_", " ")}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </TableCell>
              <TableCell className="text-right">
                <button
                  className="text-xs text-primary hover:underline"
                  onClick={() => onSelect(d.id)}
                >
                  View details
                </button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function DamageDetailDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: damage, isLoading } = useQuery({
    queryKey: ["damage-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_markers")
        .select(
          "id, reported_at, damage_type, description, status, view, x_coordinate, y_coordinate, source, approved, approved_at, rejection_reason, vehicle_id, driver_id, vehicle:vehicles(id, registration_number, make, model), driver:drivers(name, surname, employee_number)"
        )
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as DamageMarker;
    },
  });

  const { data: photos } = useQuery({
    queryKey: ["damage-photos", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("damage_marker_photos")
        .select("id, photo_url, approved")
        .eq("damage_marker_id", id);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: blueprints } = useQuery({
    queryKey: ["vehicle-blueprints", damage?.vehicle_id],
    enabled: !!damage?.vehicle_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicle_blueprints")
        .select("view, blueprint_image")
        .eq("vehicle_id", damage!.vehicle_id);
      if (error) throw error;
      return data || [];
    },
  });

  const approve = useMutation({
    mutationFn: async (approveFlag: boolean) => {
      const update = approveFlag
        ? { approved: true, approved_at: new Date().toISOString(), status: "open" }
        : { approved: true, approved_at: new Date().toISOString(), status: "closed", rejection_reason: rejectionReason || "Rejected by admin" };
      const { error } = await supabase.from("damage_markers").update(update).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["admin-damages"] });
      qc.invalidateQueries({ queryKey: ["damage-detail", id] });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const blueprintImages: Partial<Record<BlueprintView, string>> = {};
  for (const b of blueprints || []) {
    blueprintImages[b.view as BlueprintView] = getPublicUrl("vehicle-blueprints", b.blueprint_image);
  }

  const marker: BlueprintMarker | null = damage
    ? {
        id: damage.id,
        x: damage.x_coordinate,
        y: damage.y_coordinate,
        view: damage.view,
        source: damage.source,
        color: damage.source === "baseline" ? "hsl(220 80% 55%)" : "hsl(0 80% 50%)",
      }
    : null;

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {damage?.source === "baseline" ? "Baseline Damage" : "Driver-Reported Damage"}
            {damage && !damage.approved && (
              <Badge variant="outline" className="border-amber-500 text-amber-600">
                Pending Approval
              </Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Clock className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : damage ? (
          <div className="space-y-6 py-4">
            {/* Quick Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Car className="h-4 w-4" /> Vehicle
                </div>
                <p className="mt-1 font-medium">{damage.vehicle?.registration_number}</p>
                <p className="text-xs text-muted-foreground">
                  {damage.vehicle?.make} {damage.vehicle?.model}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-4 w-4" /> Reported by
                </div>
                <p className="mt-1 font-medium">
                  {damage.driver?.name} {damage.driver?.surname}
                </p>
                <p className="text-xs text-muted-foreground">{damage.driver?.employee_number}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Calendar className="h-4 w-4" /> Date
                </div>
                <p className="mt-1 font-medium">{new Date(damage.reported_at).toLocaleDateString()}</p>
                <p className="text-xs text-muted-foreground">{new Date(damage.reported_at).toLocaleTimeString()}</p>
              </div>
              <div className="rounded-lg border p-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="h-4 w-4" /> Type
                </div>
                <p className="mt-1 font-medium capitalize">{damage.damage_type.replace("_", " ")}</p>
                <Badge variant="outline" className="mt-1 capitalize">
                  {damage.view}
                </Badge>
              </div>
            </div>

            {damage.description && (
              <div className="rounded-lg border p-3">
                <p className="text-xs font-medium text-muted-foreground">Description</p>
                <p className="mt-1 text-sm">{damage.description}</p>
              </div>
            )}

            {/* Blueprint Location */}
            <div>
              <p className="mb-2 text-sm font-medium">Location on Blueprint</p>
              <div className="rounded-lg border bg-muted/30 p-2">
                {Object.keys(blueprintImages).length > 0 && marker ? (
                  <VehicleBlueprint
                    blueprintImages={blueprintImages}
                    markers={[marker]}
                    view={damage.view}
                    onViewChange={() => {}}
                    onAdd={() => {}}
                    onMarkerClick={() => {}}
                  />
                ) : (
                  <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                    No blueprint image for {damage.view} view
                  </div>
                )}
              </div>
            </div>

            {/* Photos */}
            <div>
              <p className="mb-2 text-sm font-medium">Photos ({photos?.length || 0})</p>
              {photos && photos.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((p) => (
                    <SignedImg key={p.id} bucket="damage-photos" path={p.photo_url} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No photos uploaded</p>
              )}
            </div>

            {/* Approval Actions */}
            {damage.source === "driver" && !damage.approved && (
              <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Review Required
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Approve to make this damage visible in fleet reports, or reject if it doesn&apos;t meet documentation standards.
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="default"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => approve.mutate(true)}
                  >
                    <CheckCircle2 className="mr-2 h-4 w-4" /> Approve
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      if (rejectionReason.trim() || confirm("Reject without reason?")) {
                        approve.mutate(false);
                      }
                    }}
                  >
                    <XCircle className="mr-2 h-4 w-4" /> Reject
                  </Button>
                </div>
                <div>
                  <Label className="text-xs">Rejection reason (optional)</Label>
                  <Textarea
                    rows={2}
                    placeholder="e.g., Photos unclear, damage appears pre-existing..."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* Status if approved */}
            {damage.approved && (
              <div className="flex items-center gap-2 rounded-lg border border-green-500/40 bg-green-500/5 p-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-green-900 dark:text-green-100">Approved</p>
                  {damage.approved_at && (
                    <p className="text-xs text-green-700 dark:text-green-300">
                      {new Date(damage.approved_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SignedImg({ bucket, path }: { bucket: string; path: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    getSignedUrl(bucket, path).then(setUrl).catch(() => setUrl(""));
  }, [bucket, path]);
  if (!url) return <div className="aspect-square animate-pulse rounded bg-muted" />;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="block">
      <img src={url} className="aspect-square w-full rounded border object-cover" alt="" />
    </a>
  );
}

function ReportedDuringBadge({
  value,
  source,
}: {
  value: "pre_trip" | "return" | null;
  source: string;
}) {
  if (source === "baseline") return null;
  if (!value) return null;
  if (value === "pre_trip") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
        Pre-trip
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
      Return
    </span>
  );
}
