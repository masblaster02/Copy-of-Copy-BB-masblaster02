import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { getSignedUrl } from "@/lib/storage";
import { useEffect } from "react";
import { CircleCheck as CheckCircle2, TriangleAlert as AlertTriangle, Search, X } from "lucide-react";

export default function AdminInspections() {
  const [filter, setFilter] = useState<"all" | "pre_trip" | "return">("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data } = useQuery({
    queryKey: ["admin-inspections", filter, dateFrom, dateTo],
    queryFn: async () => {
      let q = supabase
        .from("inspections")
        .select(
          "id, created_at, inspection_type, items_pass_count, items_issue_count, driver:drivers(name, surname), vehicle:vehicles(id, registration_number)",
        )
        .order("created_at", { ascending: false })
        .limit(500);
      if (filter !== "all") q = q.eq("inspection_type", filter);
      if (dateFrom) q = q.gte("created_at", dateFrom);
      if (dateTo) q = q.lte("created_at", dateTo + "T23:59:59");
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = (data || []).filter((i: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      i.vehicle?.registration_number?.toLowerCase().includes(s) ||
      i.driver?.name?.toLowerCase().includes(s) ||
      i.driver?.surname?.toLowerCase().includes(s)
    );
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
          <h1 className="text-2xl font-bold tracking-tight">Inspections</h1>
          <p className="text-sm text-muted-foreground">Pre-trip and return checklists</p>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="pre_trip">Pre-trip</SelectItem>
            <SelectItem value="return">Return</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search vehicle or driver…"
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
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Result</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  No inspections found
                </TableCell>
              </TableRow>
            )}
            {filtered.map((i: any) => {
              const hasIssues = i.items_issue_count > 0;
              const total = i.items_pass_count + i.items_issue_count;
              return (
                <TableRow key={i.id} className="cursor-pointer" onClick={() => setSelected(i.id)}>
                  <TableCell>{new Date(i.created_at).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {i.inspection_type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>{i.vehicle?.registration_number}</TableCell>
                  <TableCell>
                    {i.driver?.name} {i.driver?.surname}
                  </TableCell>
                  <TableCell>
                    {total === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : hasIssues ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        {i.items_issue_count} issue{i.items_issue_count !== 1 ? "s" : ""}
                        <span className="font-normal text-muted-foreground">/ {total}</span>
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        All pass
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
      <InspectionDetail id={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function InspectionDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data } = useQuery({
    queryKey: ["inspection-detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inspection_items")
        .select("id, item_name, result, notes, photos:inspection_item_photos(photo_url)")
        .eq("inspection_id", id);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Dialog open={!!id} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Inspection details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {(data || []).map((it: any) => (
            <Card key={it.id} className="p-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">{it.item_name}</p>
                <Badge variant={it.result === "pass" ? "default" : "destructive"}>{it.result}</Badge>
              </div>
              {it.notes && <p className="mt-1 text-sm text-muted-foreground">{it.notes}</p>}
              {it.photos?.length > 0 && (
                <div className="mt-2 flex gap-2 overflow-x-auto">
                  {it.photos.map((p: any, idx: number) => (
                    <SignedImg key={idx} bucket="inspection-photos" path={p.photo_url} />
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SignedImg({ bucket, path }: { bucket: string; path: string }) {
  const [url, setUrl] = useState<string>("");
  useEffect(() => {
    getSignedUrl(bucket, path).then(setUrl).catch(() => setUrl(""));
  }, [bucket, path]);
  if (!url) return <div className="h-24 w-24 animate-pulse rounded bg-muted" />;
  return <img src={url} className="h-24 w-24 rounded border object-cover" alt="" />;
}
