import { Brain } from "lucide-react"
import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
  size?: "sm" | "md" | "lg"
  showText?: boolean
}

const sizeClasses = {
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
}

const textClasses = {
  sm: "text-lg",
  md: "text-xl",
  lg: "text-2xl",
}

export function Logo({ className, size = "md", showText = true }: LogoProps) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div className="relative">
        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary to-accent opacity-20 blur-sm" />
        <div className="relative flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent p-1.5">
          <Brain className={cn("text-white", sizeClasses[size])} />
        </div>
      </div>
      {showText && (
        <div className="flex flex-col">
          <span
            className={cn(
              "font-bold tracking-tight leading-none",
              textClasses[size]
            )}
          >
            <span className="gradient-text">Neuro</span>
            <span className="text-foreground">Screen</span>
          </span>
          {size === "lg" && (
            <span className="text-[0.65rem] font-medium tracking-widest text-muted-foreground uppercase">
              Behavioural AI Framework
            </span>
          )}
        </div>
      )}
    </div>
  )
}
