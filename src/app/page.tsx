import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return <>
    <section className="stitch-hero container">
      <div className="stitch-hero-copy">
        <span className="eyebrow">Live local inventory</span>
        <h1>Find it nearby.<br />Reserve it before you leave.</h1>
        <p className="lead">Search products available in neighbourhood stores, reserve them instantly, and collect them locally. If it is not listed, send one Flash Request to relevant nearby merchants.</p>
        <div className="actions"><Link className="button" href="/shop">Search products near you</Link><Link className="button secondary" href="/auth/sign-up?intent=vendor">List your store</Link></div>
        <div className="stitch-assurances"><span>✓ Live stock visibility</span><i /> <span>⌾ Secure reservations</span><i /> <span>▣ Local pickup</span></div>
      </div>
      <div className="stitch-search-card">
        <div className="search-demo"><small>Searching for</small><strong>USB-C charger <em>in Anna Nagar</em></strong></div>
        <Image className="stitch-product-image" src="/products/usb-charger-hub.jpg" alt="USB-C charger, cable and multi-port hub" width={700} height={700} priority />
        <div className="result-demo"><div><strong>65W USB-C GaN Charger</strong><small>Northside Electronics · Anna Nagar</small></div><strong>₹1,499</strong></div>
        <Link className="button" href="/shop" style={{ width: "100%" }}>Reserve now</Link>
        <Link className="stitch-text-link" href="/flash-requests/new">Not finding what you need? Try a Flash Request</Link>
      </div>
    </section>

    <section className="stitch-trust"><div className="container">
      <span>✓ Stock checked before reservation</span><span>▦ Pickup code for every order</span><span>◇ Atomic stock protection</span><span>⌖ Built for neighbourhood stores</span>
    </div></section>

    <section id="how-it-works" className="section container stitch-steps">
      <h2>From search to pickup in three steps.</h2>
      <div className="grid-3">
        {[
          ["01", "Search your zone", "Choose a real ZoneMart zone and search current merchant inventory."],
          ["02", "Reserve or request", "Reserve listed stock atomically. If it is missing, send a Flash Request."],
          ["03", "Pick it up locally", "Show the secure pickup code before the server-controlled hold expires."],
        ].map(([n,title,copy]) => <article key={n}><div className="stitch-step-number">{n}</div><h3 className="editorial">{title}</h3><p className="muted">{copy}</p></article>)}
      </div>
    </section>

    <section className="stitch-flash"><div className="container">
      <div><span className="eyebrow">When search comes up empty</span><h2 className="editorial">No failed local search becomes a dead end.</h2><p className="lead">Flash Requests bridge the gap between offline stock and online search. Describe the missing item and eligible merchants in your zone can respond with a real offer.</p><Link className="button" href="/flash-requests/new">Create a Flash Request</Link></div>
      <div className="stitch-bubbles"><div><small>Customer request</small><p>“HDMI-to-VGA adapter needed near Anna Nagar for a presentation.”</p></div><div><small>Merchant response</small><p>“Available for pickup. Ready in 10 minutes.”</p></div></div>
    </div></section>

    <section id="for-merchants" className="section container stitch-merchants">
      <div className="stitch-merchant-art" aria-hidden><span>ZM</span><p>Local stock.<br />Local certainty.</p></div>
      <div><h2 className="editorial">Local demand should reach local stores.</h2><p className="lead">ZoneMart makes merchant inventory discoverable and turns missing searches into high-intent requests—without inventing delivery, distance, or demand claims.</p>
        <ul><li><strong>Instant visibility</strong><span>Active catalogue stock appears in customer searches.</span></li><li><strong>High-intent requests</strong><span>Eligible vendors can respond to real Flash Requests.</span></li><li><strong>Protected fulfilment</strong><span>Pickup holds, codes and completion remain server-authoritative.</span></li></ul>
        <Link className="button" href="/auth/sign-up?intent=vendor">Join as a merchant</Link>
      </div>
    </section>

    <section className="container stitch-final"><h2 className="editorial">What you need may already be in your zone.</h2><div className="actions"><Link className="button" href="/shop">Find products near you</Link><Link className="button secondary" href="/auth/sign-up?intent=vendor">List your store</Link></div><p>ZoneMart — Find it in your zone. Reserve it now.</p></section>
  </>;
}
