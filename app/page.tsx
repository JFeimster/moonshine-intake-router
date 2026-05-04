const routes = [
  {
    label: "Health check",
    path: "/api/health",
    method: "GET",
    description: "Confirms the intake router is online.",
  },
  {
    label: "Partner applicant webhook",
    path: "/api/tally/partner-applicant",
    method: "POST",
    description: "Receives Tally partner applicant submissions and routes them into HubSpot and Notion.",
  },
];

export default function HomePage() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: "64px 24px" }}>
      <p style={{ fontSize: 14, letterSpacing: "0.08em", textTransform: "uppercase", color: "#666" }}>
        Moonshine Capital
      </p>
      <h1 style={{ fontSize: 42, lineHeight: 1.1, margin: "12px 0" }}>Intake Router</h1>
      <p style={{ fontSize: 18, lineHeight: 1.6, color: "#333" }}>
        Minimal webhook router for Tally partner applicant submissions. It routes clean intake data into HubSpot and Notion without Gmail labels, Google Apps Script, Zapier, Make, or a new email service.
      </p>

      <section style={{ marginTop: 40 }}>
        <h2 style={{ fontSize: 22 }}>Available routes</h2>
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          {routes.map((route) => (
            <div
              key={route.path}
              style={{
                border: "1px solid #ddd",
                borderRadius: 12,
                padding: 20,
                background: "#fafafa",
              }}
            >
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <strong>{route.label}</strong>
                <code style={{ background: "#eee", padding: "4px 8px", borderRadius: 6 }}>{route.method}</code>
              </div>
              <code style={{ display: "block", marginTop: 12 }}>{route.path}</code>
              <p style={{ marginBottom: 0, color: "#555" }}>{route.description}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
