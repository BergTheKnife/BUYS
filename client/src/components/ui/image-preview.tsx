
import { useState } from "react";
import { X, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ImagePreviewProps {
  src: string;
  alt: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ImagePreview({ src, alt, isOpen, onClose }: ImagePreviewProps) {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 3));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.5, 0.5));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handleClose = () => {
    setScale(1);
    setRotation(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 bg-black/90 border-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Image Preview</DialogTitle>
          <DialogDescription>
            Image preview with zoom and rotation controls. Press Escape or click the X button to close.
          </DialogDescription>
        </DialogHeader>
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Controls */}
          <div className="absolute top-4 right-4 flex gap-2 z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleZoomOut}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleZoomIn}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRotate}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleClose}
              className="bg-white/20 hover:bg-white/30 text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Image */}
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            <img
              src={src}
              alt={alt}
              className="max-w-full max-h-full object-contain transition-transform duration-300"
              style={{
                transform: `scale(${scale}) rotate(${rotation}deg)`,
              }}
            />
          </div>

          {/* Scale indicator */}
          <div className="absolute bottom-4 left-4 bg-white/20 text-white px-3 py-1 rounded-lg text-sm">
            {Math.round(scale * 100)}%
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
