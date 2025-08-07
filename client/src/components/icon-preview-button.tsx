import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Link } from "wouter";

export function IconPreviewButton() {
  return (
    <Link href="/icon-preview">
      <Button variant="outline" size="sm" className="flex items-center gap-2">
        <Eye className="h-4 w-4" />
        Anteprima Icona App
      </Button>
    </Link>
  );
}