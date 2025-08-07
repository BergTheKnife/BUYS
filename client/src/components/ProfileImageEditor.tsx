import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { type Crop, centerCrop, makeAspectCrop } from 'react-image-crop';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Check, X, RotateCcw, ZoomIn, ZoomOut, Move } from 'lucide-react';
import 'react-image-crop/dist/ReactCrop.css';

interface ProfileImageEditorProps {
  imageFile: File;
  onConfirm: (croppedImageBlob: Blob) => void;
  onCancel: () => void;
}

export function ProfileImageEditor({ imageFile, onConfirm, onCancel }: ProfileImageEditorProps) {
  const [imgSrc, setImgSrc] = useState<string>('');
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<Crop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load the image
  useEffect(() => {
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      setImgSrc(reader.result?.toString() || '');
    });
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // Initialize crop when image loads
  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    
    // Create a circular crop (square aspect ratio for circle display)
    const crop = centerCrop(
      makeAspectCrop(
        {
          unit: '%',
          width: 80, // Start with 80% of image width
        },
        1, // 1:1 aspect ratio for circle
        width,
        height,
      ),
      width,
      height,
    );
    
    setCrop(crop);
    setCompletedCrop(crop);
  }, []);

  // Generate canvas with cropped image
  const generateCanvas = useCallback(async () => {
    const image = imgRef.current;
    const canvas = canvasRef.current;
    const crop = completedCrop;

    if (!image || !canvas || !crop) {
      return null;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const offscreen = new OffscreenCanvas(
      crop.width * scaleX,
      crop.height * scaleY,
    );
    
    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      return null;
    }

    // Apply transformations
    ctx.save();
    
    // Translate to center for rotation
    ctx.translate(offscreen.width / 2, offscreen.height / 2);
    
    // Apply rotation
    ctx.rotate((rotate * Math.PI) / 180);
    
    // Apply scale
    ctx.scale(scale, scale);
    
    // Translate back and draw image
    ctx.translate(-offscreen.width / 2, -offscreen.height / 2);
    
    ctx.drawImage(
      image,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      offscreen.width,
      offscreen.height,
    );
    
    ctx.restore();

    // Convert to blob
    return await offscreen.convertToBlob({
      type: 'image/jpeg',
      quality: 0.95,
    });
  }, [completedCrop, scale, rotate]);

  // Update preview canvas
  useEffect(() => {
    if (completedCrop && imgRef.current && canvasRef.current) {
      generateCanvas().then((blob) => {
        if (blob && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            const img = new Image();
            img.onload = () => {
              // Clear canvas
              ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
              
              // Draw circular clipped image
              ctx.save();
              ctx.beginPath();
              ctx.arc(100, 100, 100, 0, Math.PI * 2);
              ctx.clip();
              
              // Draw the image scaled to fit the circle
              ctx.drawImage(img, 0, 0, 200, 200);
              ctx.restore();
              
              // Draw circle border
              ctx.beginPath();
              ctx.arc(100, 100, 100, 0, Math.PI * 2);
              ctx.strokeStyle = '#e2e8f0';
              ctx.lineWidth = 2;
              ctx.stroke();
            };
            img.src = URL.createObjectURL(blob);
          }
        }
      });
    }
  }, [completedCrop, scale, rotate, generateCanvas]);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      const blob = await generateCanvas();
      if (blob) {
        onConfirm(blob);
      }
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      const newCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 80,
          },
          1,
          width,
          height,
        ),
        width,
        height,
      );
      setCrop(newCrop);
      setCompletedCrop(newCrop);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Move className="h-5 w-5" />
            Modifica Immagine Profilo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Editor Section */}
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Seleziona l'area dell'immagine da utilizzare come profilo:
              </div>
              
              {imgSrc && (
                <div className="border rounded-lg overflow-hidden">
                  <ReactCrop
                    crop={crop}
                    onChange={(c) => setCrop(c)}
                    onComplete={(c) => setCompletedCrop(c)}
                    aspect={1}
                    circularCrop
                  >
                    <img
                      ref={imgRef}
                      alt="Crop"
                      src={imgSrc}
                      style={{
                        transform: `scale(${scale}) rotate(${rotate}deg)`,
                        maxHeight: '400px',
                        maxWidth: '100%',
                      }}
                      onLoad={onImageLoad}
                    />
                  </ReactCrop>
                </div>
              )}

              {/* Controls */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ZoomIn className="h-4 w-4" />
                    Zoom: {Math.round(scale * 100)}%
                  </Label>
                  <Slider
                    value={[scale]}
                    onValueChange={([value]) => setScale(value)}
                    min={0.5}
                    max={3}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Rotazione: {rotate}°
                  </Label>
                  <Slider
                    value={[rotate]}
                    onValueChange={([value]) => setRotate(value)}
                    min={-180}
                    max={180}
                    step={15}
                    className="w-full"
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Ripristina
                </Button>
              </div>
            </div>

            {/* Preview Section */}
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Anteprima del profilo:
              </div>
              
              <div className="flex justify-center">
                <div className="relative">
                  <canvas
                    ref={canvasRef}
                    width={200}
                    height={200}
                    className="border rounded-full shadow-lg"
                  />
                  <div className="absolute inset-0 rounded-full ring-4 ring-primary/20"></div>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground">
                L'immagine apparirà così nel tuo profilo
              </div>

              <Separator />

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <X className="h-4 w-4 mr-2" />
                  Annulla
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="flex-1"
                  disabled={isProcessing}
                >
                  <Check className="h-4 w-4 mr-2" />
                  {isProcessing ? 'Elaborazione...' : 'Conferma'}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}