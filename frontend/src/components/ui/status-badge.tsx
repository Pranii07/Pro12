import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

type ScreeningLevel = "LOW" | "MODERATE" | "HIGH"

interface StatusBadgeProps {
  level: ScreeningLevel
  className?: string
  size?: "sm" | "md"
}

const levelConfig: Record<
  ScreeningLevel,
  { label: string; className: string }
> = {
  LOW: {
    label: "Low",
    className:
      "bg-level-low/10 text-level-low border-level-low/30 hover:bg-level-low/20",
  },
  MODERATE: {
    label: "Moderate",
    className:
      "bg-level-moderate/10 text-level-moderate border-level-moderate/30 hover:bg-level-moderate/20",
  },
  HIGH: {
    label: "High",
    className:
      "bg-level-high/10 text-level-high border-level-high/30 hover:bg-level-high/20",
  },
}

export function StatusBadge({ level, className, size = "md" }: StatusBadgeProps) {
  const config = levelConfig[level]

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-semibold",
        config.className,
        size === "sm" && "text-xs px-2 py-0",
        className
      )}
    >
      <span
        className={cn(
          "mr-1.5 inline-block rounded-full",
          size === "sm" ? "size-1.5" : "size-2",
          level === "LOW" && "bg-level-low",
          level === "MODERATE" && "bg-level-moderate",
          level === "HIGH" && "bg-level-high"
        )}
      />
      {config.label}
    </Badge>
  )
}

// Module completion status badge
type ModuleStatus = "completed" | "skipped" | "pending" | "in-progress"

interface ModuleStatusBadgeProps {
  status: ModuleStatus
  className?: string
}

const moduleStatusConfig: Record<
  ModuleStatus,
  { label: string; className: string }
> = {
  completed: {
    label: "Completed",
    className: "bg-success/10 text-success border-success/30",
  },
  skipped: {
    label: "Skipped",
    className: "bg-muted text-muted-foreground border-border",
  },
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground border-border",
  },
  "in-progress": {
    label: "In Progress",
    className: "bg-primary/10 text-primary border-primary/30",
  },
}

export function ModuleStatusBadge({ status, className }: ModuleStatusBadgeProps) {
  const config = moduleStatusConfig[status]

  return (
    <Badge variant="outline" className={cn("text-xs", config.className, className)}>
      {config.label}
    </Badge>
  )
}
