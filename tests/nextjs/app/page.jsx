import { RecorderClient } from "../components/RecorderClient";

const projects = [
  ["Customer portal", "Product", "Live", "100%"],
  ["Mobile onboarding", "Growth", "Review", "84%"],
  ["Billing refresh", "Platform", "Live", "100%"],
  ["Partner directory", "Sales", "Draft", "36%"]
];

export default function DashboardPage() {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand"><span>N</span> Northstar</div>
        <p className="navLabel">Workspace</p>
        <a className="navItem active" href="#overview">▦ Overview</a>
        <a className="navItem" href="#projects">◫ Projects</a>
        <a className="navItem" href="#analytics">◎ Analytics</a>
        <p className="navLabel">Manage</p>
        <a className="navItem" href="#team">♙ Team</a>
        <a className="navItem" href="#settings">⚙ Settings</a>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search">⌕ &nbsp; Search projects...</div>
          <div className="profile"><span>FM</span> Faik Malik</div>
        </header>

        <div className="content">
          <RecorderClient />

          <section className="stats" aria-label="Workspace statistics">
            <article className="card stat"><p>Active projects</p><strong>12</strong><small>+2 this month</small></article>
            <article className="card stat"><p>Tasks completed</p><strong>184</strong><small>+18%</small></article>
            <article className="card stat"><p>Team members</p><strong>24</strong><small>3 online</small></article>
            <article className="card stat"><p>Hours tracked</p><strong>327</strong><small>On target</small></article>
          </section>

          <div className="grid">
            <section className="card projects">
              <div className="panelHeader"><h2>Recent projects</h2><span>View all →</span></div>
              <div className="tableWrap"><table><thead><tr><th>Project</th><th>Owner</th><th>Status</th><th>Progress</th></tr></thead>
                <tbody>{projects.map(([name, owner, status, progress]) => (
                  <tr key={name}><td><strong>{name}</strong></td><td>{owner}</td><td><span className={`pill ${status.toLowerCase()}`}>{status}</span></td><td>{progress}</td></tr>
                ))}</tbody>
              </table></div>
            </section>

            <section className="card activity">
              <div className="panelHeader"><h2>Recent activity</h2><span>Today</span></div>
              <ul>
                <li><strong>Release 2.4 deployed</strong><span>Customer portal · 12 minutes ago</span></li>
                <li><strong>New feedback received</strong><span>Mobile onboarding · 1 hour ago</span></li>
                <li><strong>Milestone completed</strong><span>Billing refresh · 3 hours ago</span></li>
              </ul>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
