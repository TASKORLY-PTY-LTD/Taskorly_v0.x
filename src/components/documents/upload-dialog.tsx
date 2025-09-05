'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { trpc } from '@/utils/trpc';
import { processFile, isSupportedFileType, getUnsupportedFileMessage } from '@/lib/file-processor';
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';

interface UploadDialogProps {
  children: React.ReactNode;
}

export function UploadDialog({ children }: UploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [fileSuccesses, setFileSuccesses] = useState<string[]>([]);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const utils = trpc.useContext();
  const { mutate: uploadDocument } = trpc.documents.upload.useMutation({
    onSuccess: () => {
      // Refresh the documents list when upload is successful
      utils.documents.list.invalidate();
    },
  });

  // File selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const errors: string[] = [];
    const validFiles: File[] = [];
    
    // Check each file for support
    files.forEach((file) => {
      if (!isSupportedFileType(file)) {
        errors.push(getUnsupportedFileMessage(file));
      } else {
        validFiles.push(file);
      }
    });
    
    // Update state
    setFileErrors(prev => [...prev, ...errors]);
    setSelectedFiles(prev => [...prev, ...validFiles]);
    
    // Clear the input
    e.target.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDialogClose = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Clear state when dialog is closed
      setSelectedFiles([]);
      setFileErrors([]);
      setFileSuccesses([]);
      setProcessingFile(null);
      setUploadProgress(0);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    
    // Ensure we're on the client side before processing
    if (!isClient) {
      setFileErrors(['Please wait for the page to fully load before uploading files.']);
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);
    setFileErrors([]);
    setFileSuccesses([]);

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file) {
          try {
            // Show which file we're processing
            setProcessingFile(file.name);
            
            // Process the file (handles all types including PDF)
            const processedFile = await processFile(file);
            
            // Extract restaurant-specific information if it's a menu/policy document
            // const restaurantInfo = extractRestaurantInfo(processedFile.content, file.name);
            
            // Prepare metadata with restaurant info
            const enhancedMetadata = {
              ...processedFile.metadata,
              originalFileName: processedFile.metadata.fileName,
              uploadedAt: new Date().toISOString(),
              // Add restaurant-specific metadata
              // dishCount: restaurantInfo.dishes.length,
              // allergenCount: restaurantInfo.allergenInfo.length,
              // policyCount: restaurantInfo.policies.length,
              // extractedDishes: restaurantInfo.dishes.slice(0, 5), // First 5 dishes for preview
              // extractedAllergens: restaurantInfo.allergenInfo.slice(0, 3), // First 3 allergen notes
            };
            
            // Upload to server with chunking
            await uploadDocument({
              title: processedFile.metadata.fileName,
              content: processedFile.content,
              metadata: enhancedMetadata,
              contentType: processedFile.metadata.fileType,
              sourceUrl: undefined, // No URL for uploaded files
            });
            
            // Track success (chunk information will be shown in the document table)
            setFileSuccesses(prev => [...prev, `Successfully processed "${file.name}" - ${processedFile.metadata.wordCount} words (chunking in progress...)`]);
            
          } catch (fileError) {
            console.error(`Failed to process file ${file.name}:`, fileError);
            
            let errorMessage = `Failed to process "${file.name}": `;
            if (fileError instanceof Error) {
              if (fileError.message.includes('No text content could be extracted')) {
                errorMessage += 'This PDF appears to be image-based or corrupted. Please try converting it to text format.';
              } else if (fileError.message.includes('PDF extraction failed')) {
                errorMessage += 'PDF processing failed. The file might be corrupted or in an unsupported format.';
              } else {
                errorMessage += fileError.message;
              }
            } else {
              errorMessage += 'Unknown error occurred.';
            }
            
            setFileErrors(prev => [...prev, errorMessage]);
          }
        }
        
        // Update progress
        setUploadProgress(((i + 1) / selectedFiles.length) * 100);
      }

      // If no errors, close dialog and clear files
      if (fileErrors.length === 0) {
        setTimeout(() => {
          setSelectedFiles([]);
          setIsOpen(false);
        }, 2000); // Show success messages for 2 seconds
      }
      
    } catch (error) {
      console.error('Upload failed:', error);
      setFileErrors(prev => [...prev, 'Upload failed. Please try again.']);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setProcessingFile(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleDialogClose}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className='sm:max-w-md'>
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Upload your restaurant documents to the knowledge base. Supports: TXT, MD, JSON (PDF temporarily disabled)
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* File Input */}
          <div className='border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center'>
            <input
              type='file'
              multiple
              accept='.txt,.md,.json'
              onChange={handleFileSelect}
              className='hidden'
              id='file-upload'
              disabled={isUploading}
            />
            <label htmlFor='file-upload' className='cursor-pointer'>
              <Upload className='mx-auto h-8 w-8 text-muted-foreground mb-2' />
              <p className='text-sm font-medium'>Click to select files</p>
              <p className='text-xs text-muted-foreground'>
                Menus, policies, SOPs, training documents
              </p>
            </label>
          </div>

          {/* Success Messages */}
          {fileSuccesses.length > 0 && (
            <div className='space-y-2'>
              {fileSuccesses.map((success, index) => (
                <div key={index} className='flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg'>
                  <CheckCircle className='h-4 w-4 text-green-600 mt-0.5' />
                  <p className='text-sm text-green-700'>{success}</p>
                </div>
              ))}
            </div>
          )}

          {/* Error Messages */}
          {fileErrors.length > 0 && (
            <div className='space-y-2'>
              {fileErrors.map((error, index) => (
                <div key={index} className='flex items-start space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg'>
                  <AlertCircle className='h-4 w-4 text-destructive mt-0.5' />
                  <p className='text-sm text-destructive'>{error}</p>
                </div>
              ))}
            </div>
          )}

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className='space-y-2 max-h-40 overflow-y-auto'>
              {selectedFiles.map((file, index) => (
                <div
                  key={index}
                  className='flex items-center justify-between p-2 bg-muted/50 rounded'
                >
                  <div className='flex items-center space-x-2'>
                    <FileText className='h-4 w-4' />
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm font-medium truncate'>
                        {file.name}
                      </p>
                      <p className='text-xs text-muted-foreground'>
                        {formatFileSize(file.size)} • {file.type.includes('pdf') ? 'PDF' : 'Text'}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant='ghost'
                    size='icon'
                    onClick={() => removeFile(index)}
                    disabled={isUploading}
                    className='h-6 w-6'
                  >
                    <X className='h-3 w-3' />
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Progress */}
          {isUploading && (
            <div className='space-y-2'>
              <div className='flex items-center justify-between text-sm'>
                <span>
                  {processingFile ? `Processing ${processingFile}...` : 'Uploading files...'}
                </span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className='w-full' />
              {processingFile && (
                <p className='text-xs text-muted-foreground'>
                  Extracting text content, analyzing document structure, and creating intelligent chunks with Gemini AI...
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className='flex justify-end space-x-2'>
            <Button
              variant='outline'
              onClick={() => handleDialogClose(false)}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={selectedFiles.length === 0 || isUploading}
            >
              {isUploading ? 'Processing...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}