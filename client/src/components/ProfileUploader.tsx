import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ProfileUploaderProps {
  currentImageUrl?: string;
  onImageUpdate?: (imageUrl: string) => void;
}

export function ProfileUploader({ currentImageUrl, onImageUpdate }: ProfileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      // Get upload URL
      const uploadData = await apiRequest('/api/profile/upload-url', 'POST');
      const uploadURL = uploadData.uploadURL;

      // Upload file to GCS
      const uploadResponse = await fetch(uploadURL, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type,
        }
      });

      if (!uploadResponse.ok) {
        throw new Error('Errore durante l\'upload dell\'immagine');
      }

      // Update user profile with new image URL
      return await apiRequest('/api/profile/update-image', 'POST', {
        imageUrl: uploadURL.split('?')[0]
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Successo",
        description: "Immagine profilo aggiornata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      onImageUpdate?.(data.profileImageUrl);
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message || "Errore nell'aggiornamento dell'immagine profilo",
        variant: "destructive",
      });
      setPreviewUrl(currentImageUrl);
    },
    onSettled: () => {
      setIsUploading(false);
    }
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Errore",
        description: "Seleziona solo file immagine",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Errore",
        description: "L'immagine deve essere più piccola di 5MB",
        variant: "destructive",
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload file
    setIsUploading(true);
    uploadMutation.mutate(file);
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-gray-200 bg-gray-100 flex items-center justify-center">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Foto profilo"
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="w-8 h-8 text-gray-400" />
          )}
        </div>
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          </div>
        )}
      </div>
      
      <div>
        <input
          type="file"
          id="profile-image"
          accept="image/*"
          onChange={handleFileChange}
          disabled={isUploading}
          className="hidden"
        />
        <Button
          asChild
          variant="outline"
          size="sm"
          disabled={isUploading}
        >
          <label htmlFor="profile-image" className="cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            {previewUrl ? 'Cambia Foto' : 'Carica Foto'}
          </label>
        </Button>
      </div>
    </div>
  );
}