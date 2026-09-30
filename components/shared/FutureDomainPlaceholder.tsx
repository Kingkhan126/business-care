import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Lock, Sparkles, Layers } from "lucide-react";

export interface FutureDomainPlaceholderProps {
  title: string;
  domainName: string;
  targetPhase: string;
  description: string;
  plannedFeatures: string[];
}

export function FutureDomainPlaceholder({
  title,
  domainName,
  targetPhase,
  description,
  plannedFeatures,
}: FutureDomainPlaceholderProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
            <Badge variant="outline" className="gap-1 font-mono text-[10px]">
              <Lock className="h-3 w-3 text-slate-400" />
              {targetPhase}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
      </div>

      <Card className="border-slate-200">
        <CardContent className="pt-6">
          <EmptyState
            title={`${domainName} Module Architecture Initialized`}
            description={`Architectural boundaries and database RBAC permissions for ${domainName} are established. Functional workflows will be implemented in ${targetPhase} without fake functionality.`}
            icon={<Layers className="h-6 w-6 text-indigo-600" />}
          />

          <div className="mt-8 border-t border-slate-200 pt-6">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Planned Capabilities for {domainName} ({targetPhase})
            </h4>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {plannedFeatures.map((feature, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 text-xs text-slate-700 font-medium"
                >
                  &bull; {feature}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
