import Link from "next/link";

export default function Home() {
  return <>
    <section className="container hero">
      <div>
        <div className="eyebrow">Nearby inventory, made certain</div>
        <h1>Find it in your zone.<br />Reserve it now.</h1>
        <p className="lead">Discover products that are actually available at nearby stores, reserve them for pickup, and ask local merchants when an item is not listed.</p>
        <div className="actions"><Link className="button" href="/shop">Search nearby</Link><Link className="button secondary" href="/auth/sign-up?intent=vendor">List your store</Link></div>
      </div>
      <div className="hero-visual" aria-label="Product search preview">
        <div className="search-demo">65W USB-C charger</div>
        <div className="result-demo">
          <div className="store"><span className="store-icon">N</span>Northside Electronics · Anna Nagar</div>
          <h3>65W USB-C GaN Charger</h3>
          <div className="product-meta"><span className="price">₹1,499</span><span className="availability"><span className="dot" />2 available</span></div>
        </div>
      </div>
    </section>
    <section className="section container">
      <div className="section-head"><span className="eyebrow">How ZoneMart works</span><h2>From search to pickup, without the uncertainty.</h2></div>
      <div className="grid-3">
        {[
          ["01", "Search your zone", "See real products, stock and merchant identity for stores near you."],
          ["02", "Reserve with certainty", "Checkout creates a protected 30-minute pickup hold and secure code."],
          ["03", "Recover every search", "If it is not listed, a Flash Request invites eligible local merchants to respond."],
        ].map(([n, title, copy]) => <article className="card" key={n}><div className="step-number">{n}</div><h3>{title}</h3><p className="muted">{copy}</p></article>)}
      </div>
    </section>
    <section className="split">
      <div><span className="eyebrow">Listed products</span><h2>Available means available.</h2><p className="lead">Browse current stock, reserve directly or build a single-store cart. The database protects the final unit from being sold twice.</p><Link className="button" href="/shop">Browse products</Link></div>
      <div><span className="eyebrow" style={{ color: "var(--citron)" }}>Flash Request</span><h2 className="editorial">No failed local search becomes a dead end.</h2><p style={{ lineHeight: 1.7, opacity: .8 }}>Tell nearby merchants what you need. Compare real offers, accept one, and receive the same protected pickup hold.</p><Link className="button secondary" href="/flash-requests/new">Create a request</Link></div>
    </section>
    <section className="section container">
      <div className="card" style={{ maxWidth: 760, marginInline: "auto" }}><span className="eyebrow">Built for local commerce</span><h2>Merchant identity stays visible.</h2><p className="lead">Every product and offer is tied to a real ZoneMart store and zone. We show operational facts—never invented distance, reviews, or delivery promises.</p></div>
      <div className="cta"><h2>Know before you go.</h2><p className="muted">Start with a nearby search. If the product is missing, let local merchants find a way.</p><div className="actions" style={{ justifyContent: "center" }}><Link className="button" href="/shop">Search nearby</Link></div></div>
    </section>
  </>;
}
