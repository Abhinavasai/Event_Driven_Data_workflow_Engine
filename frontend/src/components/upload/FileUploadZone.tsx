import clsx from 'clsx';
import { FileUp } from 'lucide-react';
import { useCallback, useState, type DragEvent } from 'react';
import { formatFileSize } from '../../lib/formatters';

interface FileUploadZoneProps {
  file: File | null;
  onFileSelect: (file: File | null) => void;
  disabled?: boolean;
}

export function FileUploadZone({ file, onFileSelect, disabled }: FileUploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragOver(false);
      if (disabled) return;
      const dropped = event.dataTransfer.files?.[0];
      if (dropped) onFileSelect(dropped);
    },
    [disabled, onFileSelect],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={clsx(
        'card flex flex-col items-center justify-center border-2 border-dashed px-6 py-12 text-center transition',
        dragOver ? 'border-brand bg-sky-50' : 'border-surface-border',
        disabled && 'opacity-60',
      )}
    >
      <FileUp className="mb-3 h-10 w-10 text-slate-400" />
      <p className="text-sm font-medium text-slate-800">Drag and drop a CSV or JSON file</p>
      <p className="mt-1 text-xs text-slate-500">or click to browse (max 500 MB)</p>
      <label className="btn-secondary mt-4 cursor-pointer">
        Select file
        <input
          type="file"
          className="hidden"
          accept=".csv,.json,text/csv,application/json"
          disabled={disabled}
          onChange={(e) => onFileSelect(e.target.files?.[0] ?? null)}
        />
      </label>
      {file && (
        <p className="mt-4 text-sm text-slate-600">
          Selected: <span className="font-medium">{file.name}</span> ({formatFileSize(file.size)})
        </p>
      )}
    </div>
  );
}
