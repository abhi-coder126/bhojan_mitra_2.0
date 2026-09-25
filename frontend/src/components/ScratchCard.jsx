import { useEffect, useRef, useState } from "react";
import { Gift, Sparkles, X, CheckCircle2, Clock3 } from "lucide-react";
import "./CustomerRewards.css";

export default function ScratchCard({ title, offerText, expiresAt, onReveal, onClose }) {
  const canvasRef = useRef(null);
  const dialogRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const locked = useRef(false);
  const scratching = useRef(false);
  const strokes = useRef(0);
  useEffect(() => {
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current.showModal();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width; canvas.height = height;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#edd6a5"); gradient.addColorStop(.45, "#fff0ce"); gradient.addColorStop(1, "#d8b878");
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "#ffffff45";
    for (let x = -height; x < width; x += 24) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + height, height); ctx.stroke(); }
    ctx.fillStyle = "#76572d"; ctx.textAlign = "center"; ctx.font = "700 17px sans-serif";
    ctx.fillText("A little mystery. A lovely reward.", width / 2, height / 2 - 8);
    ctx.font = "500 12px sans-serif"; ctx.fillText("Scratch here to discover yours", width / 2, height / 2 + 20);
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  const revealCard = async () => {
    if (locked.current || revealed) return;
    locked.current = true; setBusy(true); setError("");
    try { await onReveal?.(); setRevealed(true); }
    catch { setError("Your reward is safe. Please try revealing it again."); }
    finally { locked.current = false; setBusy(false); }
  };
  const scratchAt = (event) => {
    if (revealed || locked.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d"); ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath(); ctx.arc((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height, 25, 0, Math.PI * 2); ctx.fill();
    strokes.current += 1;
    if (strokes.current > 26) revealCard();
  };
  const expiry = expiresAt ? new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
  return <dialog className="reward-win-dialog" ref={dialogRef} aria-labelledby="reward-win-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}>
    <div className={`reward-win-content ${revealed ? "is-revealed" : ""}`}>
      <button type="button" className="rw-close" aria-label="Close reward" disabled={busy} onClick={onClose}><X size={19} /></button>
      <div className="rw-decoration" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div>
      <span className="rw-gift">{revealed ? <CheckCircle2 size={36} /> : <Gift size={36} />}</span>
      <span className="rw-eyebrow">{revealed ? "A TREAT, JUST FOR YOU" : "YOU’VE EARNED SOMETHING SPECIAL"}</span>
      <h2 id="reward-win-title">{revealed ? "Lucky looks good on you!" : "Your next happy surprise"}</h2>
      <p className="rw-subtitle">{revealed ? "A little thank you for being part of our table." : "Go on, scratch the golden card. This one’s yours."}</p>
      <div className="rw-scratch-area"><div className="rw-offer" aria-hidden={!revealed}>{revealed ? <><Sparkles size={25} /><span>YOUR REWARD</span><h3>{title}</h3><p>{offerText || "Your reward has been unlocked."}</p></> : <Gift size={38} />}</div>{!revealed && <canvas ref={canvasRef} className="rw-canvas" aria-hidden="true" onPointerDown={(event) => { scratching.current = true; event.currentTarget.setPointerCapture(event.pointerId); scratchAt(event); }} onPointerMove={(event) => { if (scratching.current) scratchAt(event); }} onPointerUp={() => { scratching.current = false; }} onPointerCancel={() => { scratching.current = false; }} />}</div>
      <div className="rw-feedback" aria-live="polite">{error ? <p role="alert" className="rw-error">{error}</p> : revealed ? <p><CheckCircle2 size={14} /> Saved in My Rewards</p> : <p><Sparkles size={14} /> A small scratch. A big smile.</p>}</div>
      {revealed && expiry && <p className="rw-expiry"><Clock3 size={13} /> Valid until {expiry}</p>}
      <button type="button" className="rw-primary" disabled={busy} onClick={revealed ? onClose : revealCard}>{busy ? "Unwrapping your reward…" : revealed ? "Lovely, thank you!" : error ? "Try again" : "Tap to reveal instead"}</button>
      {!revealed && <span className="rw-footnote">Your surprise will be saved to your rewards.</span>}
    </div>
  </dialog>;
}
