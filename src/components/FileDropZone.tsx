import { useRef, useState } from "react";

interface FileDropZoneProps {
  disabled?: boolean;
  onFile: (file: File) => void;
}

const ACCEPTED_EXTENSIONS = [".nsf", ".nsfe"];

function isAccepted(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
}

export function FileDropZone({ disabled, onFile }: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const submit = (file?: File) => {
    if (file && isAccepted(file)) onFile(file);
  };

  return (
    <section
      className={`drop-zone ${dragging ? "is-dragging" : ""}`}
      onDragEnter={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        submit(event.dataTransfer.files[0]);
      }}
    >
      <input
        ref={inputRef}
        hidden
        type="file"
        accept=".nsf,.nsfe"
        disabled={disabled}
        onChange={(event) => submit(event.target.files?.[0])}
      />
      <span className="drop-zone__eyebrow">LOCAL FILE / NO UPLOAD</span>
      <strong>拖入 NSF 或 NSFe</strong>
      <span>第一阶段先验证文件头、曲目与芯片信息</span>
      <button
        className="theme-button"
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        选择文件
      </button>
    </section>
  );
}
