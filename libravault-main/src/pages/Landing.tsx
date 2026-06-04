import { Link } from 'react-router-dom'
import './Landing.css'

export default function Landing() {
  return (
    <main className="landing-page" aria-label="Jerry Thrift Shop app download">
      <section className="landing-card">
        <p className="landing-kicker">Mobile App</p>
        <h1>Jerry Thrift Shop</h1>
        <p className="landing-intro">
          Download the Android app below, then use the admin login link if you need to manage the store.
        </p>

        <a className="landing-download" href="/downloads/jerry-thrift-shop.apk" download>
          Download APK
        </a>

        <p className="landing-note">
          If the download does not start, make sure the APK file is uploaded in the{' '}
          <strong>downloads</strong> folder on Hostinger.
        </p>

        <div className="landing-divider" />

        <p className="landing-admin-label">Admin access</p>
        <Link className="landing-admin" to="/login">
          Open Admin Login
        </Link>
      </section>
    </main>
  )
}
