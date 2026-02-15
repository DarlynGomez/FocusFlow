import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { UploadCloud, File as FileIcon, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface FileUploaderProps {
  file: File | null;
  setFile: (file: File | null) => void;
}

export default function FileUploader({ file, setFile }: FileUploaderProps) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    // We only accept one file at a time
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, [setFile]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
  });

  // If a file is selected, show a "File Selected" state instead of the dropzone
  if (file) {
    return (
      <div className="flex items-center justify-between p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div className="flex items-center gap-3">
          <FileIcon className="w-8 h-8 text-indigo-500" />
          <div>
            <p className="text-sm font-medium text-slate-900">{file.name}</p>
            <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        </div>
        <button 
          onClick={() => setFile(null)}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    );
  }

  // The actual Dropzone area
  return (
    <div
      {...getRootProps()}
      className={twMerge(clsx(
        "flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
        isDragActive 
          ? "border-indigo-500 bg-indigo-50/50" 
          : "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-indigo-300"
      ))}
    >
      <input {...getInputProps()} />
      <UploadCloud className={clsx(
        "w-10 h-10 mb-3",
        isDragActive ? "text-indigo-500" : "text-slate-400"
      )} />
      <p className="text-sm font-medium text-slate-700">
        {isDragActive ? "Drop the PDF here..." : "Click or drag a PDF here"}
      </p>
      <p className="text-xs text-slate-500 mt-1">Maximum file size 10MB</p>
    </div>
  );
}