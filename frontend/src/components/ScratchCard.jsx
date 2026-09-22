import { useEffect, useRef, useState } from "react";
import { Gift, PartyPopper } from "lucide-react";

// A real scratch-to-reveal card: draws a foil layer on a canvas over the offer,
// and erases it (via destination-out compositing) as the pointer drags across it.
// Once enough of the foil is cleared it auto-reveals the rest and calls onReveal.
export default function ScratchCard({ title, offerText, expiresAt, onReveal, onClose }) {
  const canvasRef = useRef(null);
  const [revealed, setRevealed] = useState(false);
  const scratching = useRef(false);
  const clearedPixels = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width;
    canvas.height = height;

    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, "#c9ccd1");
    gradient.addColorStop(1, "#9aa0ab");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "#5b6270";
    ctx.font = "700 14px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SCRATCH HERE", width / 2, height / 2 - 6);
    ctx.font = "500 11px sans-serif";
    ctx.fillText("to reveal your reward", width / 2, height / 2 + 14);
  }, []);

  const scratchAt = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || revealed) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const ctx = canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(x, y, 26, 0, Math.PI * 2);
    ctx.fill();

    clearedPixels.current += 1;
    if (clearedPixels.current > 26) {
      revealCard();
    }
  };

  const revealCard = () => {
    setRevealed(true);
    onReveal?.();
  };

  const handlePointerDown = (e) => {
    scratching.current = true;
    scratchAt(e.clientX, e.clientY);
  };

  const handlePointerMove = (e) => {
    if (!scratching.current) return;
    scratchAt(e.clientX, e.clientY);
  };

  const stopScratching = () => {
    scratching.current = false;
  };

  const expiryLabel = expiresAt
    ? new Date(expiresAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "";

  return (
    <div className="scratch-overlay">
      <div className="scratch-card">
        <button type="button" className="scratch-close" onClick={onClose}>
          &times;
        </button>

        <div className="scratch-card-head">
          <Gift size={22} />
          <span>You've won a reward!</span>
        </div>

        <div className="scratch-card-body">
          <div className="scratch-offer">
            {revealed && <PartyPopper size={26} className="scratch-confetti-icon" />}
            <h3>{title}</h3>
            <p>{offerText}</p>
          </div>

          {!revealed && (
            <canvas
              ref={canvasRef}
              className="scratch-canvas"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={stopScratching}
              onPointerLeave={stopScratching}
            />
          )}
        </div>

        {revealed && expiryLabel && (
          <p className="scratch-validity">Valid till {expiryLabel} -- saved to your profile.</p>
        )}

        {revealed && (
          <button type="button" className="scratch-done-btn" onClick={onClose}>
            Awesome, thanks!
          </button>
        )}
      </div>
    </div>
  );
}
