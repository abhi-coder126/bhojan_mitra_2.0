import { Gift, Sparkles, Clock3, ArrowUpRight } from "lucide-react";
import "./CustomerRewards.css";
const expiry = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "";
export default function CustomerRewards({ rewards, onOpen }) {
  const available = rewards.filter((reward) => !reward.expired);
  return <section className="customer-rewards" aria-label="My rewards">
    <header className="cr-heading"><span className="cr-heading-icon"><Gift size={22} /></span><div><span className="cr-eyebrow">A LITTLE THANK YOU</span><h3>Your reward collection</h3></div><span className="cr-count">{available.length} available</span></header>
    {!rewards.length ? <div className="cr-empty"><span><Sparkles size={30} /></span><h4>Good food. Lovely surprises.</h4><p>Your rewards will appear here as you earn them. Come back after your next order.</p></div> : <div className="cr-list">{rewards.map((reward) => <article key={reward.id} className={`cr-ticket ${reward.expired ? "is-expired" : ""} ${!reward.scratched ? "is-wrapped" : ""}`}>
      <div className="cr-ticket-main"><span className="cr-gift"><Gift size={23} /></span><div className="cr-ticket-copy"><span className="cr-label">{reward.expired ? "EXPIRED REWARD" : reward.scratched ? "UNLOCKED FOR YOU" : "A SURPRISE IS WAITING"}</span><h4>{reward.title}</h4><p>{reward.scratched ? reward.offerText : reward.expired ? "This surprise is no longer available." : "A little something to make your next visit sweeter."}</p></div></div>
      <footer><span><Clock3 size={13} />{reward.expired ? "Expired" : reward.expiresAt ? `Valid until ${expiry(reward.expiresAt)}` : "No expiry date"}</span>{!reward.expired && !reward.scratched ? <button type="button" onClick={() => onOpen(reward)}>Unwrap reward <ArrowUpRight size={15} /></button> : <b>{reward.expired ? "Ended" : "Revealed"}</b>}</footer>
    </article>)}</div>}
  </section>;
}
