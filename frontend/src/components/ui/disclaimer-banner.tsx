import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface DisclaimerBannerProps {
  className?: string
  variant?: "default" | "compact"
}

export function DisclaimerBanner({
  className,
  variant = "default",
}: DisclaimerBannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-warning/30 bg-warning/5 text-sm",
        variant === "default" ? "p-4" : "px-3 py-2",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="text-muted-foreground leading-relaxed">
          <strong className="font-semibold text-foreground">Disclaimer:</strong>{" "}
          This application is intended for behavioural screening and
          educational/research purposes only. It is NOT a medical diagnosis and
          cannot replace evaluation by a qualified healthcare professional.
        </p>
      </div>
    </div>
  )
}

export function PrototypeBanner({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-xs",
        className
      )}
    >
      <p className="text-muted-foreground">
        <strong className="font-semibold text-accent">
          Research/Educational Prototype
        </strong>{" "}
        — trained and evaluated on synthetic data. Not clinically validated.
      </p>
    </div>
  )
}
