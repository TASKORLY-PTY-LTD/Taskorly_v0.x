'use client';

/**
 * Upload Dialog Component
 *
 * This component handles file uploads for the document management system.
 * It supports two different processing paths:
 *
 * 1. TEXT FILES (TXT, MD, JSON):
 *    - Processed client-side using FileReader API
 *    - Text content extracted immediately
 *    - Sent to server for AI chunking and storage
 *
 * 2. PDF FILES:
 *    - Converted to base64 format for server transmission
 *    - Sent to server for PDF parsing using pdf2json library
 *    - Server extracts text, creates AI chunks, and stores everything
 *
 * The component provides a unified interface for both file types while
 * handling the different processing requirements behind the scenes.
 */

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
import {
  processFile,
  isSupportedFileType,
  getUnsupportedFileMessage,
  preparePDFForServer,
  processPDFFile,
} from '@/lib/file-processor';

// Helper function to get file type from extension (copied from file-processor.ts)
function getFileTypeFromExtension(fileName: string): string {
  const extension = fileName.split('.').pop()?.toLowerCase();

  switch (extension) {
    case 'txt':
      return 'text/plain';
    case 'md':
    case 'markdown':
      return 'text/markdown';
    case 'json':
      return 'application/json';
    case 'pdf':
      return 'application/pdf';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    default:
      return 'text/plain';
  }
}
import { Upload, FileText, X, AlertCircle, CheckCircle } from 'lucide-react';

interface UploadDialogProps {
  children: React.ReactNode;
}

export function UploadDialog({ children }: UploadDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [fileSuccesses, setFileSuccesses] = useState<string[]>([]);
  const [processingFile, setProcessingFile] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  const utils = trpc.useContext();

  // PDF upload mutation for server-side processing
  // This mutation handles PDF files differently from text files:
  // 1. PDFs are sent as base64 data to the server
  // 2. Server parses the PDF using pdf2json library
  // 3. Server extracts text and creates chunks using Gemini AI
  // 4. Server stores the document and chunks in the database
  const { mutate: uploadPDF } = trpc.documents.uploadPDF.useMutation({
    onSuccess: () => {
      // Refresh the documents list when PDF upload is successful
      // This ensures the new PDF document appears in the UI
      utils.documents.list.invalidate();
    },
  });

  const { mutate: processDocument } =
    trpc.documents.processDocument.useMutation({
      onSuccess: () => {
        // Refresh the documents list when PDF upload is successful
        // This ensures the new PDF document appears in the UI
        utils.documents.list.invalidate();
      },
    });

  // File selection handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const errors: string[] = [];
    const validFiles: File[] = [];

    // Check each file for support
    files.forEach(file => {
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
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    if (!isClient) {
      setFileErrors([
        'Please wait for the page to fully load before uploading files.',
      ]);
      return;
    }

    setIsUploading(true);
    setFileErrors([]);
    setFileSuccesses([]);

    // Track errors locally to check at the end
    const errorsList: string[] = [];

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        if (file) {
          try {
            setProcessingFile(file.name);

            const fileType = file.type || getFileTypeFromExtension(file.name);

            if (fileType === 'application/pdf') {
              const pdfData = await preparePDFForServer(file);

              // Upload PDF
              const uploadedDoc = await new Promise<any>((resolve, reject) => {
                uploadPDF(
                  {
                    title: pdfData.fileName,
                    fileData: pdfData.fileData,
                    fileName: pdfData.fileName,
                    fileSize: pdfData.fileSize,
                    sourceUrl: undefined,
                    metadata: {
                      originalFileName: pdfData.fileName,
                      uploadedAt: new Date().toISOString(),
                      fileSize: pdfData.fileSize,
                      fileType: pdfData.fileType,
                    },
                  },
                  {
                    onSuccess: data => resolve(data),
                    onError: error => reject(error),
                  }
                );
              });

              // Wait for table refresh
              await new Promise(resolve => setTimeout(resolve, 500));

              // Close dialog immediately
              setSelectedFiles([]);
              setIsOpen(false);
              setIsUploading(false);
              setProcessingFile(null);

              // Continue processing in background (fire and forget)
              processDocument(
                {
                  documentId: uploadedDoc.id,
                },
                {
                  onSuccess: () => {
                    console.log(
                      `Successfully processed ${file.name} in background`
                    );
                  },
                  onError: error => {
                    console.error(
                      `Background processing failed for ${file.name}:`,
                      error
                    );
                  },
                }
              );
            }
          } catch (fileError) {
            console.error(`Failed to process file ${file.name}:`, fileError);

            let errorMessage = `Failed to process "${file.name}": `;
            if (fileError instanceof Error) {
              if (
                fileError.message.includes('No text content could be extracted')
              ) {
                errorMessage +=
                  'This PDF appears to be image-based or corrupted.';
              } else if (fileError.message.includes('PDF extraction failed')) {
                errorMessage +=
                  'PDF processing failed. The file might be corrupted.';
              } else if (
                fileError.message.includes(
                  'PDF processing must be handled by the upload dialog'
                )
              ) {
                continue;
              } else {
                errorMessage += fileError.message;
              }
            } else {
              errorMessage += 'Unknown error occurred.';
            }

            errorsList.push(errorMessage);
            setFileErrors(prev => [...prev, errorMessage]);
          }
        }
      }

      // Only run this if there were errors (dialog already closed on success)
      if (errorsList.length > 0) {
        setIsUploading(false);
        setProcessingFile(null);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setFileErrors(prev => [...prev, 'Upload failed. Please try again.']);
      setIsUploading(false);
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
            Upload your restaurant documents to the knowledge base. Supports:
            TXT, MD, JSON, and PDF files
          </DialogDescription>
        </DialogHeader>

        <div className='space-y-4'>
          {/* File Input */}
          <div className='border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center'>
            <input
              type='file'
              multiple
              accept='.txt,.md,.json,.pdf'
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
                <div
                  key={index}
                  className='flex items-start space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg'
                >
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
                <div
                  key={index}
                  className='flex items-start space-x-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg'
                >
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
                        {formatFileSize(file.size)} •{' '}
                        {getFileTypeFromExtension(file.name) ===
                        'application/pdf'
                          ? 'PDF'
                          : 'Text'}
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
              {isUploading
                ? 'Processing...'
                : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
