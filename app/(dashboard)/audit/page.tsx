import { getCurrentSessionUser } from "@/lib/auth/session";
import { AuditService } from "@/server/services/AuditService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { ShieldCheck, User } from "lucide-react";

export default async function AuditPage() {
  const user = await getCurrentSessionUser();
  let logs: Awaited<ReturnType<typeof AuditService.listAuditLogs>> = [];
  let errorMsg: string | null = null;

  if (user) {
    try {
      logs = await AuditService.listAuditLogs(user);
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Failed to load audit logs";
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          System Audit Trail
        </h1>
        <p className="text-xs text-slate-500">
          Immutable audit records of administrative, security, and data modifications within your tenant.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Audit Log Entries ({logs.length})
          </CardTitle>
          <CardDescription>
            Chronological record of system actions scoped to this organization.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg ? (
            <div className="p-4 text-xs font-medium text-red-600 bg-red-50 rounded-md border border-red-200">
              {errorMsg}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">No audit log entries recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Metadata</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs font-medium text-slate-900">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        {log.actor?.name || "System"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="info" className="font-mono text-[11px]">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-700">
                      {log.entityType || "N/A"}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500 max-w-xs truncate">
                      {log.metadata ? JSON.stringify(log.metadata) : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
