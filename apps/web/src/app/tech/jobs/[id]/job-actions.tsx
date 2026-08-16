"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { techAddNote, techComplete, techSetStatus } from "@/lib/tech/actions";

const bigBtn =
  "w-full rounded-xl py-3.5 text-center text-sm font-bold text-white disabled:opacity-50";

/** Field workflow (spec §39): En Route → Arrived → Start → Complete. */
export function JobActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [showComplete, setShowComplete] = useState(false);
  const [issue, setIssue] = useState("");
  const [component, setComponent] = useState("");
  const [completeNote, setCompleteNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [photoCategory, setPhotoCategory] = useState("before");

  async function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    setError(null);
    const result = await fn();
    setBusy(false);
    if (result.ok) router.refresh();
    else setError(result.error ?? "Something went wrong.");
  }

  async function uploadPhoto(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    const form = new FormData();
    form.append("file", files[0]!);
    form.append("category", photoCategory);
    const res = await fetch(`/api/jobs/${appointmentId}/photos`, {
      method: "POST",
      body: form,
    });
    setUploading(false);
    if (res.ok) {
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } else {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Upload failed.");
    }
  }

  const done = status === "completed" || status === "cancelled";

  return (
    <section className="mt-4 space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>
      )}

      {!done && (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={busy || status === "en_route"}
            onClick={() => run(() => techSetStatus({ appointmentId, to: "en_route" }))}
            className={`${bigBtn} bg-navy`}
          >
            En route
          </button>
          <button
            type="button"
            disabled={busy || status === "arrived"}
            onClick={() => run(() => techSetStatus({ appointmentId, to: "arrived" }))}
            className={`${bigBtn} bg-navy`}
          >
            Arrived
          </button>
          <button
            type="button"
            disabled={busy || status === "in_progress"}
            onClick={() => run(() => techSetStatus({ appointmentId, to: "in_progress" }))}
            className={`${bigBtn} bg-navy`}
          >
            Start
          </button>
        </div>
      )}

      {/* Photos */}
      <div className="rounded-xl border border-line bg-white p-3">
        <div className="flex items-center gap-2">
          <select
            value={photoCategory}
            onChange={(e) => setPhotoCategory(e.target.value)}
            className="rounded-lg border border-line px-2 py-2 text-sm"
            aria-label="Photo category"
          >
            <option value="before">Before</option>
            <option value="equipment_label">Model / serial label</option>
            <option value="after">After</option>
            <option value="other">Other</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            capture="environment"
            disabled={uploading}
            onChange={(e) => uploadPhoto(e.target.files)}
            className="flex-1 text-sm text-slate file:mr-2 file:rounded-lg file:border-0 file:bg-mist file:px-3 file:py-2 file:text-xs file:font-semibold file:text-navy"
          />
        </div>
        {uploading && <p className="mt-1 text-xs text-slate">Uploading…</p>}
      </div>

      {/* Note */}
      <div className="rounded-xl border border-line bg-white p-3">
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a diagnosis or job note…"
          className="min-h-16 w-full rounded-lg border border-line px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={busy || note.trim().length < 2}
          onClick={() =>
            run(async () => {
              const result = await techAddNote({ appointmentId, body: note });
              if (result.ok) setNote("");
              return result;
            })
          }
          className="mt-2 rounded-lg bg-navy px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Save note
        </button>
      </div>

      {/* Complete */}
      {!done &&
        (showComplete ? (
          <div className="rounded-xl border-2 border-point bg-white p-4">
            <h3 className="font-bold text-navy">Complete job</h3>
            <label className="mt-2 block text-sm font-semibold text-navy">
              What was repaired?
              <input
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                placeholder="e.g. Replaced evaporator fan motor — cooling restored"
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-2 block text-sm font-semibold text-navy">
              Component / area <span className="font-normal text-slate">(optional)</span>
              <input
                value={component}
                onChange={(e) => setComponent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </label>
            <label className="mt-2 block text-sm font-semibold text-navy">
              Outcome note <span className="font-normal text-slate">(optional)</span>
              <textarea
                value={completeNote}
                onChange={(e) => setCompleteNote(e.target.value)}
                className="mt-1 min-h-14 w-full rounded-lg border border-line px-3 py-2 text-sm"
              />
            </label>
            <p className="mt-2 text-xs text-slate">
              Completing starts the labor warranty for this specific repair.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowComplete(false)}
                className="rounded-xl border border-line py-3 text-sm font-bold text-slate"
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy || issue.trim().length < 3}
                onClick={() =>
                  run(() =>
                    techComplete({
                      appointmentId,
                      issueRepaired: issue,
                      componentRepaired: component,
                      note: completeNote,
                    }),
                  )
                }
                className={`${bigBtn} bg-point`}
              >
                {busy ? "Saving…" : "Complete job"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowComplete(true)}
            className={`${bigBtn} bg-point`}
          >
            Complete job…
          </button>
        ))}
    </section>
  );
}
