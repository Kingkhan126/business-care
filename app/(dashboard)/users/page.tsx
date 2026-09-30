import { getCurrentSessionUser } from "@/lib/auth/session";
import { TeamService } from "@/server/services/TeamService";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { getInitials } from "@/lib/utils";
import { Users, Shield, Mail } from "lucide-react";

export default async function UsersPage() {
  const user = await getCurrentSessionUser();
  let members: Awaited<ReturnType<typeof TeamService.listMembers>> = [];
  let errorMsg: string | null = null;

  if (user) {
    try {
      members = await TeamService.listMembers(user);
    } catch (err: unknown) {
      errorMsg = err instanceof Error ? err.message : "Failed to load members";
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            Team Directory & Member Access
          </h1>
          <p className="text-xs text-slate-500">
            View active team members, assigned roles, and server-enforced permissions.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-5 w-5 text-indigo-600" />
            Active Organization Directory ({members.length})
          </CardTitle>
          <CardDescription>
            Members authorized to access this organization tenant.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {errorMsg ? (
            <div className="p-4 text-xs font-medium text-red-600 bg-red-50 rounded-md border border-red-200">
              {errorMsg}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Assigned Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white shadow-xs">
                          {getInitials(m.user.name)}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{m.user.name}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {m.user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 border border-slate-200">
                        <Shield className="h-3.5 w-3.5 text-indigo-600" />
                        {m.role.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.status === "ACTIVE" ? "success" : "warning"}>
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-mono text-slate-500">
                      {new Date(m.joinedAt).toLocaleDateString()}
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
