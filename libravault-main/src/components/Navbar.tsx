import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { ShoppingBag, Heart, Search, Menu, X, ChevronDown, User, BookOpen } from 'lucide-react'
import { useStore } from '../store/useStore'
import { hasPermission } from '../lib/rbac'
import './Navbar.css'

interface NavLink {
  label: string
  to: string
}

const NAV_LINKS: NavLink[] = [
  { label: 'Fiction',     to: '/products?cat=fiction' },
  { label: 'Non-Fiction', to: '/products?cat=non-fiction' },
  { label: 'Science',     to: '/products?cat=science' },
  { label: 'History',     to: '/products?cat=history' },
]

export default function Navbar() {
  const { user, role, logout, getCartCount, wishlistIds } = useStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQ, setSearchQ] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const cartCount = getCartCount()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
    setProfileOpen(false)
  }, [location])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQ.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQ)}`)
      setSearchOpen(false)
      setSearchQ('')
    }
  }

  return (
    <nav className={`navbar${scrolled ? ' scrolled' : ''}`}>
      <div className="navbar-inner">
        <Link to="/" className="navbar-logo" aria-label="LibraVault Home" style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 20, letterSpacing: '-0.5px', color: 'inherit', textDecoration: 'none' }}>
          <BookOpen size={24} />
          LibraVault
        </Link>

        <div className={`navbar-links${menuOpen ? ' open' : ''}`}>
          {NAV_LINKS.map((l) => (
            <Link key={l.label} to={l.to} className="nav-link">
              {l.label}
            </Link>
          ))}
        </div>

        <div className="navbar-actions">
          <button className="action-btn" onClick={() => setSearchOpen((s) => !s)} aria-label="Search">
            <Search size={20} />
          </button>

          <Link to="/wishlist" className="action-btn" aria-label="Wishlist">
            <Heart size={20} />
            {wishlistIds.length > 0 && <span className="action-badge">{wishlistIds.length}</span>}
          </Link>

          <Link to="/cart" className="action-btn" aria-label="Cart">
            <ShoppingBag size={20} />
            {cartCount > 0 && <span className="action-badge">{cartCount}</span>}
          </Link>

          {user ? (
            <div className="profile-dropdown">
              <button
                className="action-btn profile-btn"
                onClick={() => setProfileOpen((s) => !s)}
                aria-label="Profile menu"
              >
                <User size={20} />
                <ChevronDown size={14} />
              </button>
              {profileOpen && (
                <div className="dropdown-menu">
                  <span className="dropdown-name">{user.email?.split('@')[0]}</span>
                  <Link to="/profile" className="dropdown-item">My Profile</Link>
                  <Link to="/orders" className="dropdown-item">My Orders</Link>
                  <Link to="/wishlist" className="dropdown-item">Reading List</Link>
                  {hasPermission(role, 'admin:access') && (
                    <Link to="/admin" className="dropdown-item admin-link">Admin Panel</Link>
                  )}
                  <button onClick={logout} className="dropdown-item logout-btn">Sign Out</button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="btn btn-sm btn-primary">Sign In</Link>
          )}

          <button
            className="action-btn mobile-menu-btn"
            onClick={() => setMenuOpen((s) => !s)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="search-bar">
          <form onSubmit={handleSearch} className="search-form">
            <Search size={18} className="search-icon" />
            <input
              autoFocus
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="Search for books, authors, genres..."
              className="search-input"
            />
            <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search">
              <X size={18} />
            </button>
          </form>
        </div>
      )}
    </nav>
  )
}