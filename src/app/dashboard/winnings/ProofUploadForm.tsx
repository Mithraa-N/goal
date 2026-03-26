"use client";

import { useState, useTransition, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Upload, Loader2, CheckCircle, Image, FileText } from "lucide-react";

interface ProofUploadFormProps {
  winningId: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // Stricter 5MB limit
const ALLOWED_TYPES = ["image/jpeg", "image/png", "application/pdf"];

export function ProofUploadForm({ winningId }: ProofUploadFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (file) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Invalid file type. Only JPG, PNG, and PDF are allowed.");
        setPreview(null);
        setFileName(null);
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError("File size too large. Max 5MB allowed.");
        setPreview(null);
        setFileName(null);
        return;
      }

      setFileName(file.name);
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (ev) => setPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null); // PDF placeholder handled in UI
      }
    }
  }

  function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Please select a file first.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        // Upload to PRIVATE bucket 'winner-proofs'
        // Path includes user ID to ensure RLS can verify ownership correctly
        const fileExt = file.name.split(".").pop();
        const filePath = `${user.id}/${winningId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("winner-proofs")
          .upload(filePath, file, { cacheControl: "3600", upsert: true });

        if (uploadError) throw uploadError;

        // Save PATH, not public URL, to the DB for security.
        // Public exposure is blocked by bucket being private.
        const { error: dbError } = await supabase
          .from("winnings")
          .update({ proof_url: filePath }) // Store relative path
          .eq("id", winningId)
          .eq("user_id", user.id); // Extra security: ensure updating own win

        if (dbError) throw dbError;

        setSuccess(true);
      } catch (err: any) {
        setError(err.message || "Failed to upload proof. Please try again.");
      }
    });
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 text-green-400 text-sm p-4 glass rounded-xl">
        <CheckCircle size={16} />
        Proof submitted successfully! Awaiting verification.
      </div>
    );
  }

  return (
    <div className="card space-y-4">
      {error && (
        <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-xs text-center border-dashed mb-2 animate-shake">
          {error}
        </div>
      )}

      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300 ${
          preview || fileName ? "border-blue-500/40 bg-blue-500/5" : "border-[var(--border)] hover:border-blue-500/30"
        }`}
        onClick={() => fileRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="Preview" className="max-h-32 mx-auto rounded-lg shadow-lg mb-2" />
        ) : fileName ? (
          <div className="flex flex-col items-center gap-2">
            <FileText size={40} className="text-blue-400" />
            <p className="text-sm font-medium text-white">{fileName}</p>
          </div>
        ) : (
          <div>
            <Image size={32} className="text-[var(--text-muted)] mx-auto mb-3" />
            <p className="text-sm text-white font-medium">Select winner verification proof</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">JPG, PNG, PDF (Max 5MB)</p>
          </div>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        onClick={handleUpload}
        disabled={isPending || (!preview && !fileName)}
        className="btn btn-primary w-full shadow-lg shadow-blue-500/20"
      >
        {isPending ? (
          <><Loader2 size={16} className="animate-spin" /> Finalizing...</>
        ) : (
          <><Upload size={16} /> Confirm & Upload</>
        )}
      </button>

      <p className="text-[10px] text-[var(--text-muted)] text-center">
        By uploading, you certify this score proof is genuine and matches your submitted record.
      </p>
    </div>
  );
}
