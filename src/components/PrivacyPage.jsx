import React from "react";
import { ArrowLeft } from "lucide-react";
export default function PrivacyPage({ content, navigate }) {
  const email = content.profile?.email;
  return (
    <div className="site-shell">
      <header className="site-header">
        <div className="content-width header-inner">
          <button
            className="brand-sign"
            onClick={() => navigate("/")}
            aria-label="Back to portfolio"
          >
            K<span>.</span>
          </button>
        </div>
      </header>
      <main className="content-width policy-page">
        <button className="case-back" onClick={() => navigate("/")}>
          <ArrowLeft size={17} /> Back to portfolio
        </button>
        <h1>Privacy & enquiries</h1>
        <p>
          This portfolio is operated for the purpose of showcasing creative work
          and receiving brand collaboration enquiries.
        </p>
        <h2>Information collected</h2>
        <p>
          When you send an enquiry, you provide your name, email, optional
          company, selected service, and message. These details are stored in
          the site's Supabase database and used to respond to your request.
        </p>
        <h2>Security & spam prevention</h2>
        <p>
          Enquiry submissions use Cloudflare Turnstile verification. The site
          does not intentionally store the Turnstile token or visitor IP address
          in the enquiries table. Cloudflare and Supabase may process technical
          information under their own privacy policies.
        </p>
        <h2>Retention & removal</h2>
        <p>
          Enquiries are retained while needed to manage collaborations and
          business communications. To request access or removal, contact the
          portfolio owner
          {email ? (
            <>
              {" "}
              at <a href={`mailto:${email}`}>{email}</a>
            </>
          ) : (
            <> through the social contact link on the portfolio</>
          )}
          .
        </p>
        <h2>External media</h2>
        <p>
          Embedded videos, social links, and externally hosted images may
          involve third-party services. Visiting those services is subject to
          their policies.
        </p>
        <p>
          <strong>Before publishing:</strong> the owner should review this
          notice against actual data practices and applicable privacy laws.
        </p>
      </main>
    </div>
  );
}
