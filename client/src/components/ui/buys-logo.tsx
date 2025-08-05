import { cn } from "@/lib/utils";

interface BuysLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-12 h-12", 
  lg: "w-16 h-16",
  xl: "w-24 h-24"
};

export function BuysLogo({ className, size = "md" }: BuysLogoProps) {
  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn(
        sizeClasses[size], 
        "relative bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold shadow-lg"
      )}>
        <div className="text-center">
          <div className="text-lg font-black tracking-tight">BUYS</div>
          <div className="text-xs opacity-80 tracking-wider">BUILD SUCCESS</div>
        </div>
        {/* Decorative X element in corner */}
        <div className="absolute top-1 right-1 w-2 h-2 opacity-50">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-full h-0.5 bg-white rotate-45"></div>
            <div className="absolute w-full h-0.5 bg-white -rotate-45"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function BuysText({ className, showTagline = false }: { className?: string; showTagline?: boolean }) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-2xl font-bold text-blue-600">BUYS</span>
      {showTagline && (
        <span className="text-sm text-muted-foreground">Build Up Your Store</span>
      )}
    </div>
  );
}