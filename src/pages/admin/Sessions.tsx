import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Circle as XCircle, Search, X } from "lucide-react";

function formatDuration(startedAt: string, endedAt: string | null): string {
  if (!endedAt) return "—";
  const mins = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

export default function AdminSessions() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [closingId, setClosingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-sessions", filter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("vehicle_sessions")
        .select(
          "id, started_at, ended_at, status, odometer_start, odometer_end, driver:drivers(name, surname, employee_number), vehicle:vehicles(registration_number, id)",
        )
        .order("started_at", { ascending: false })
        .limit(500);
      if (filter !== "all") q = q.eq("status", filter);
      if (dateFrom) q = q.gte("started_at", dateFrom);
      if (dateTo) q = q.lte("started_at", dateTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data || []).filter((s: any) => {
    if (!search) return true;
    const t = search.toLowerCase();
    return (
      s.driver?.name?.toLowerCase().includes(t) ||
      s.driver?.surname?.toLowerCase().includes(t) ||
      s.driver?.employee_number?.toLowerCase().includes(t) ||
      s.vehicle?.registration_number?.toLowerCase().includes(t)
    );
  });

  const closeSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const session = data?.find((s: any) => s.id === sessionId);
      const { error } = await supabase
        .from("vehicle_sessions")
        .update({ status: "completed", ended_at: new Date().toISOString() })
        .eq("id", sessionId);
      if (error) throw error;
      if (session?.vehicle?.id) {
        await supabase
          .from("vehicles")
          .update({ status: "available" })
          .eq("id", session.vehicle.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-sessions"] });
      toast.success("Session closed and vehicle marked available");
      setClosingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function clearFilters() {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setFilter("all");
  }

  const hasFilters = search || dateFrom || dateTo || filter !== "all";

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
          <p className="text-sm text-muted-foreground">Vehicle assignments</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search driver or vehicle…"
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Started</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Odometer (km)</TableHead>
              <TableHead>Returned</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  No sessions found
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>
                  <Link
                    to={`/admin/sessions/${s.id}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    {new Date(s.started_at).toLocaleString()}
                  </Link>
                </TableCell>
                <TableCell>
                  {s.driver?.name} {s.driver?.surname}{" "}
                  <span className="text-xs text-muted-foreground">({s.driver?.employee_number})</span>
                </TableCell>
                <TableCell>
                  {s.vehicle?.id ? (
                    <Link
                      to={`/admin/vehicles/${s.vehicle.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {s.vehicle.registration_number}
                    </Link>
                  ) : (
                    s.vehicle?.registration_number
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatDuration(s.started_at, s.ended_at)}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.odometer_start != null || s.odometer_end != null ? (
                    <span>
                      {s.odometer_start ?? "—"} → {s.odometer_end ?? "—"}
                      {s.odometer_start != null && s.odometer_end != null && (
                        <span className="ml-1 text-xs">({(s.odometer_end - s.odometer_start).toFixed(0)} km)</span>
                      )}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {s.ended_at ? new Date(s.ended_at).toLocaleString() : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={s.status === "active" ? "default" : "secondary"}>{s.status}</Badge>
                </TableCell>
                <TableCell>
                  {s.status === "active" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setClosingId(s.id)}
                      title="Force close session"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <AlertDialog open={!!closingId} onOpenChange={(o) => !o && setClosingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Force close session?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the session as completed and set the vehicle back to available. Use this to clean up sessions where the driver could not complete the return inspection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => closingId && closeSession.mutate(closingId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Force close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
