import { useState } from "react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Upload, User } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ProfileImageEditor } from "./ProfileImageEditor";

interface ProfileUploaderProps {
  currentImageUrl?: string;
  onImageUpdate?: (imageUrl: string) => void;
}

export function ProfileUploader({ currentImageUrl, onImageUpdate }: ProfileUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(currentImageUrl);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Update preview URL when currentImageUrl changes
  useState(() => {
    setPreviewUrl(currentImageUrl);
  }, [currentImageUrl]);

  const uploadMutation = useMutation({
    mutationFn: async (processedBlob: Blob) => {
      try {
        console.log('🚀 Starting profile image upload...');
        
        // Convert blob to file
        const file = new File([processedBlob], 'profile.jpg', { type: 'image/jpeg' });
        console.log('✅ File created:', file.size, 'bytes');
        
        // Get upload URL
        console.log('📡 Requesting upload URL...');
        const urlResponse = await apiRequest('POST', '/api/profile/upload-url');
        const uploadData = await urlResponse.json();
        const uploadURL = uploadData.uploadURL;
        console.log('✅ Upload URL received:', uploadURL);

        // Upload file to GCS
        console.log('📤 Uploading file to storage...');
        const uploadResponse = await fetch(uploadURL, {
          method: 'PUT',
          body: file,
          headers: {
            'Content-Type': file.type,
          }
        });

        if (!uploadResponse.ok) {
          const errorText = await uploadResponse.text();
          console.error('❌ Upload failed:', uploadResponse.status, errorText);
          throw new Error(`Errore durante l'upload dell'immagine: ${uploadResponse.status} ${errorText}`);
        }

        console.log('✅ File uploaded successfully');

        // Update user profile with new image URL
        console.log('📡 Updating user profile...');
        const response = await apiRequest('POST', '/api/profile/update-image', {
          imageUrl: uploadURL.split('?')[0]
        });
        
        const result = await response.json();
        console.log('✅ Profile updated successfully');
        return result;
      } catch (error) {
        console.error('❌ Upload mutation error:', error);
        throw error;
      }
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

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "Errore",
        description: "L'immagine deve essere più piccola di 10MB",
        variant: "destructive",
      });
      return;
    }

    // Store file and show editor
    setSelectedFile(file);
    setShowEditor(true);
  };

  const handleEditorConfirm = async (croppedImageBlob: Blob) => {
    setShowEditor(false);
    setIsUploading(true);
    
    // Create preview URL from blob
    const previewUrl = URL.createObjectURL(croppedImageBlob);
    setPreviewUrl(previewUrl);
    
    // Upload the processed image
    uploadMutation.mutate(croppedImageBlob);
  };

  const handleEditorCancel = () => {
    setShowEditor(false);
    setSelectedFile(null);
  };

  return (
    <>
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

      {/* Image Editor Modal */}
      {showEditor && selectedFile && (
        <ProfileImageEditor
          imageFile={selectedFile}
          onConfirm={handleEditorConfirm}
          onCancel={handleEditorCancel}
        />
      )}
    </>
  );
}