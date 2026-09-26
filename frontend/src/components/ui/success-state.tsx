import { CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface SuccessStateProps {
  title?: string
  description?: string
  action?: React.ReactNode
  className?: string
}

export function SuccessState({
  title = "Success!",
  description,
  action,
  className,
}: SuccessStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 text-center",
        className
      )}
    >
      <div className="rounded-xl bg-success/10 p-4 mb-4">
        <CheckCircle2 className="size-8 text-success" />
      </div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
