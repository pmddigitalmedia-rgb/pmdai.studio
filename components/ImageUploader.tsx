
import React, { useCallback, useState } from 'react';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE_MB } from '../constants';

interface ImageUploaderProps {
  onImagesSelected: (files: File[]) => void;
  compact?: boolean;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImagesSelected, compact = false }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndPassFiles = (fileList: FileList | File[]) => {
    setError(null);
    const validFiles: File[] = [];
    const files = Array.from(fileList);
    
    let hasInvalidType = false;
    let hasInvalidSize = false;

    files.forEach(file => {
      const isAllowed = 
        ALLOWED_FILE_TYPES.includes(file.type) ||
        file.type.startsWith('image/') ||
        file.type.startsWith('video/') ||
        file.type === 'application/pdf' ||
        /\.(jpe?g|png|webp|gif|pdf|mp4|mov|webm|m4v|mkv|ogg)$/i.test(file.name);

      if (!isAllowed) {
        hasInvalidType = true;
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        hasInvalidSize = true;
        return;
      }
      validFiles.push(file);
    });

    if (hasInvalidType) {
      setError("Some files skipped (unsupported format)");
    } else if (hasInvalidSize) {
      setError(`Some files too large (> ${MAX_FILE_SIZE_MB}MB)`);
    }

    if (validFiles.length > 0) {
      onImagesSelected(validFiles);
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndPassFiles(e.dataTransfer.files);
    }
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndPassFiles(e.target.files);
    }
  }, []);

  const acceptString = "image/*,video/*,application/pdf,.mp4,.mov,.webm,.m4v,.mkv";

  if (compact) {
    return (
       <div 
        className={`
          relative group cursor-pointer w-full h-32 rounded-3xl 
          border-2 border-dashed transition-all duration-300
          flex flex-col items-center justify-center overflow-hidden
          ${isDragging 
            ? 'border-orange-500 bg-orange-500/10 scale-[0.98]' 
            : 'border-slate-800 hover:border-orange-500/50 bg-slate-900/50 hover:bg-slate-800'
          }
        `}
       >
         <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
            onChange={handleFileInput}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            accept={acceptString}
            multiple
          />
          <div className="w-8 h-8 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mb-2 group-hover:bg-orange-500/20 group-hover:text-orange-500 transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
             </svg>
          </div>
          <span className="text-xs font-bold text-slate-500 group-hover:text-orange-400 tracking-wide uppercase">Add Photos & Videos</span>
       </div>
    );
  }

  return (
    <div
      className={`
        relative group cursor-pointer
        w-full h-80 rounded-[2.5rem] border-2 border-dashed transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1)
        flex flex-col items-center justify-center text-center p-8 overflow-hidden
        ${isDragging 
          ? 'border-orange-500 bg-orange-500/10 scale-[0.98] shadow-[inset_0_0_20px_rgba(249,115,22,0.1)]' 
          : 'border-slate-800 bg-slate-900/30 hover:border-orange-500/40 hover:bg-slate-800 hover:shadow-2xl hover:shadow-orange-900/10'
        }
      `}
    >
      <input
        type="file"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
        onChange={handleFileInput}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        accept={acceptString}
        multiple
      />
      
      <div className={`
        relative w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-800 to-slate-900 text-orange-500 mb-6 
        flex items-center justify-center shadow-lg shadow-black/20 border border-white/5 transition-all duration-500
        ${isDragging ? 'scale-110 rotate-3 text-orange-400' : 'group-hover:scale-110 group-hover:-rotate-3 group-hover:text-orange-400 group-hover:border-orange-500/30'}
      `}>
        <div className="relative">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-10 h-10">
            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
          </svg>
          <span className="absolute -bottom-1 -right-2 bg-orange-500 text-black text-[9px] font-black px-1 rounded shadow-sm">
            ▶
          </span>
        </div>
      </div>

      <div className="relative z-10">
        <h3 className="text-xl font-bold text-slate-200 tracking-tight group-hover:text-white transition-colors">Upload Photos, Videos or PDF</h3>
        <p className="text-slate-500 font-medium mt-2 group-hover:text-slate-400">Drag & drop high-res property images or video clips to get started</p>
      </div>
      
      <div className="mt-8 flex flex-wrap justify-center gap-2">
         {['JPG', 'PNG', 'WEBP', 'MP4', 'MOV', 'WEBM', 'PDF'].map(ext => (
            <span key={ext} className="text-[10px] font-bold px-2.5 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700">
               {ext}
            </span>
         ))}
      </div>

      {error && (
        <div className="absolute bottom-6 left-0 right-0 px-6 animate-bounce">
          <div className="inline-block bg-red-900/80 border border-red-500/30 text-red-200 text-xs px-4 py-2 rounded-xl font-bold shadow-lg backdrop-blur-sm">
            {error}
          </div>
        </div>
      )}
    </div>
  );
};
