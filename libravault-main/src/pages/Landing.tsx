import { Link } from 'react-router-dom'
import { BookOpen, Download, ShieldCheck, Smartphone } from 'lucide-react'
import './Landing.css'

const APK_URL = 'https://expo.dev/artifacts/eas/3xi2XmTLWytZrGRCMVyzQB.apk'

export default function Landing() {
  return (
    <main className="landing-page" aria-label="LibraVault mobile app download">
      <section className="landing-card">

        {/* Logo mark */}
        <div className="landing-logo-wrap">
          <BookOpen size={28} strokeWidth={2} color="#7c3aed" />
        </div>

        <p className="landing-kicker">Mobile App</p>
        <h1>LibraVault</h1>
        <p className="landing-intro">
          A digital bookstore platform where customers browse and purchase books,
          sellers manage their listings, and admins oversee the entire ecosystem —
          all connected through one shared database.
        </p>

        {/* Feature pills */}
        <div className="landing-pills">
          <span className="landing-pill"><Smartphone size={13} /> Customer App</span>
          <span className="landing-pill"><ShieldCheck size={13} /> Seller Dashboard</span>
          <span className="landing-pill"><BookOpen size={13} /> Books &amp; Orders</span>
        </div>

        <a
          className="landing-download"
          href={APK_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download size={18} strokeWidth={2.5} />
          Download APK
        </a>

        <p className="landing-note">
          Android only · Requires Android 8.0 or higher
        </p>

        <div className="landing-divider" />

        <p className="landing-admin-label">Manage your store</p>
        <Link className="landing-admin" to="/login">
          Open Admin Dashboard
        </Link>
      </section>
    </main>
  )
}
