import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import RichTextEditor from './RichTextEditor';
import './index.css';

const API_URL = 'http://127.0.0.1:4000/api';

function Login({ setGlobalToken, setGlobalUsername }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isRegistering) {
        if (password !== confirmPassword) {
          return alert('Passwords do not match!');
        }
        await axios.post(`${API_URL}/auth/register`, { username, email, password });
        
        // Also initialize their profile with their username
        try {
          await axios.post(`${API_URL}/users/${username}`, { name: username, bio: '' });
        } catch (profileErr) {
          console.error('Failed to init profile:', profileErr);
        }

        alert('Registration successful! You can now login.');
        setIsRegistering(false);
        setPassword('');
        setConfirmPassword('');
      } else {
        const res = await axios.post(`${API_URL}/auth/login`, { username, password });
        setGlobalToken(res.data.token);
        setGlobalUsername(username);
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('username', username);
      }
    } catch (err) {
      console.error('Auth error:', err);
      let errorMsg = 'Authentication failed';
      if (err.response) {
        if (typeof err.response.data === 'string') {
          errorMsg += ` - Server returned an unexpected HTML or text response (Status: ${err.response.status}). The API Gateway might not be routing correctly.`;
        } else {
          errorMsg = err.response.data?.message || err.response.data?.error || `Server Error: ${err.response.status}`;
        }
      } else if (err.request) {
        errorMsg += ' - No response from server. Make sure your Docker containers are running and the API Gateway is accessible on port 4000.';
      } else {
        errorMsg += ` - ${err.message}`;
      }
      alert(errorMsg);
    }
  };

  return (
    <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '1rem' }} className="logo">Nexus</h2>
        <h3 style={{ textAlign: 'center', marginBottom: '2rem', color: 'var(--text-muted)' }}>
          {isRegistering ? 'Create an Account' : 'Welcome Back'}
        </h3>
        <form onSubmit={handleAuth}>
          <input 
            type="text" 
            className="input-field" 
            placeholder="Username" 
            value={username} 
            onChange={e => setUsername(e.target.value)} 
            required 
          />
          {isRegistering && (
            <input 
              type="email" 
              className="input-field" 
              placeholder="Email" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
            />
          )}
          <input 
            type="password" 
            className="input-field" 
            placeholder="Password" 
            value={password} 
            onChange={e => setPassword(e.target.value)} 
            required 
          />
          {isRegistering && (
            <input 
              type="password" 
              className="input-field" 
              placeholder="Confirm Password" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required 
            />
          )}
          <button type="submit" className="btn" style={{ width: '100%', marginTop: '1rem' }}>
            {isRegistering ? 'Register' : 'Login'}
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--text-muted)' }}>
          {isRegistering ? 'Already have an account? ' : "Don't have an account? "}
          <span 
            onClick={() => setIsRegistering(!isRegistering)} 
            style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline' }}
          >
            {isRegistering ? 'Login here' : 'Register here'}
          </span>
        </div>
      </div>
    </div>
  );
}

function Layout({ username, handleLogout, children }) {
  return (
    <div className="app-container">
      <header className="header">
        <Link to="/our-space" className="logo" style={{ textDecoration: 'none' }}>Nexus</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <nav style={{ display: 'flex', gap: '1rem' }}>
            <Link to="/our-space" style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: '500' }}>Our Space</Link>
            <Link to="/my-space" style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: '500' }}>My Space</Link>
          </nav>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }}></div>
          <Link to="/my-space" style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: 'bold' }}>
            {username}
          </Link>
          <button className="btn" onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--primary)', color: 'var(--text-main)', padding: '0.4rem 1rem' }}>Logout</button>
        </div>
      </header>
      <main>
        {children}
      </main>
    </div>
  );
}

function OurSpace({ currentUsername }) {
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchOurSpaceFeed();
  }, [currentUsername]);

  const fetchOurSpaceFeed = async () => {
    try {
      // 1. Get who we follow
      const profileRes = await axios.get(`${API_URL}/users/${currentUsername}`);
      const following = profileRes.data.following || [];
      
      // 2. Fetch their public posts
      if (following.length > 0) {
        const postsRes = await axios.get(`${API_URL}/posts?userIds=${following.join(',')}`);
        setPosts(postsRes.data);
      } else {
        setPosts([]);
      }
    } catch (err) {
      console.error('Error fetching our space feed:', err);
    }
  };

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    
    setIsSearching(true);
    try {
      const res = await axios.get(`${API_URL}/auth/search?q=${encodeURIComponent(q)}`);
      setSearchResults(res.data);
    } catch (err) {
      console.error('Search error:', err);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    const hasImage = newPostContent.includes('<img');
    const strippedContent = newPostContent.replace(/<[^>]*>/g, '').trim();
    if (!strippedContent && !hasImage) return;
    try {
      await axios.post(`${API_URL}/posts`, { userId: currentUsername, content: newPostContent, visibility });
      setNewPostContent('');
      setVisibility('public');
      fetchOurSpaceFeed();
    } catch (err) {
      console.error('Post error:', err);
    }
  };

  return (
    <>
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '0.5rem 1rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.5rem' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input 
            type="text" 
            placeholder="Search for people..." 
            value={searchQuery}
            onChange={handleSearch}
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text-main)', outline: 'none', fontSize: '1rem' }}
          />
        </div>
        
        {isSearching && searchQuery && (
          <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '1rem' }}>
            <h4 style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Search Results</h4>
            {searchResults.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {searchResults.map(u => (
                  <Link key={u.userId} to={`/profile/${u.userId}`} className="search-result-item" style={{ display: 'flex', alignItems: 'center', padding: '0.5rem', borderRadius: '4px', textDecoration: 'none', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--primary)', flex: 1 }}>{u.name || u.userId}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{u.userId}</div>
                  </Link>
                ))}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>No users found.</div>
            )}
          </div>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: '3rem' }}>
        <h3>Create a Post</h3>
        <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <RichTextEditor
            value={newPostContent}
            onChange={setNewPostContent}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="submit" className="btn">Post</button>
            <div className="visibility-toggle">
              <button
                type="button"
                className={`visibility-btn ${visibility === 'public' ? 'active' : ''}`}
                onClick={() => setVisibility('public')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Public
              </button>
              <button
                type="button"
                className={`visibility-btn ${visibility === 'private' ? 'active' : ''}`}
                onClick={() => setVisibility('private')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Private
              </button>
            </div>
          </div>
        </form>
      </div>

      <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Our Space Feed
      </h3>
      <div className="post-grid">
        {posts.map(post => (
          <div key={post._id} className="glass-card">
            <div className="post-header">
              <Link to={`/profile/${post.userId}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                {post.userId}
              </Link>
              <span style={{ color: 'var(--text-muted)' }}> • {new Date(post.createdAt).toLocaleString()}</span>
            </div>
            <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>
        ))}
        {posts.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>You aren't following anyone yet, or they haven't posted. Use the search bar above to find people!</p>}
      </div>
    </>
  );
}


function MySpace({ currentUsername }) {
  const [profile, setProfile] = useState({ name: '', bio: '', followers: [], following: [] });
  const [posts, setPosts] = useState([]);
  const [newPostContent, setNewPostContent] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, [currentUsername]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/${currentUsername}`);
      setProfile({ name: res.data.name || '', bio: res.data.bio || '', followers: res.data.followers || [], following: res.data.following || [] });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts?userId=${currentUsername}&viewer=${currentUsername}`);
      setPosts(res.data);
    } catch (err) {
      console.error('Error fetching user posts:', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/users/${currentUsername}`, profile);
      setIsEditing(false);
    } catch (err) {
      console.error('Error updating profile:', err);
    }
  };

  const handlePost = async (e) => {
    e.preventDefault();
    const hasImage = newPostContent.includes('<img');
    const strippedContent = newPostContent.replace(/<[^>]*>/g, '').trim();
    if (!strippedContent && !hasImage) return;
    try {
      await axios.post(`${API_URL}/posts`, { userId: currentUsername, content: newPostContent, visibility });
      setNewPostContent('');
      setVisibility('public');
      fetchUserPosts();
    } catch (err) {
      console.error('Post error:', err);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (activeTab === 'all') return true;
    return post.visibility === activeTab;
  });

  return (
    <>
      <div className="glass-card" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2 className="logo" style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>{profile.name || currentUsername}</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>{profile.bio || 'No bio provided yet.'}</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          <div><strong style={{ color: 'var(--text-main)' }}>{profile.followers.length}</strong> Followers</div>
          <div><strong style={{ color: 'var(--text-main)' }}>{profile.following.length}</strong> Following</div>
        </div>
        
        {!isEditing && (
          <button className="btn" onClick={() => setIsEditing(true)}>Edit Profile</button>
        )}

        {isEditing && (
          <form onSubmit={handleUpdateProfile} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: '400px', margin: '0 auto' }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Display Name" 
              value={profile.name} 
              onChange={e => setProfile({...profile, name: e.target.value})} 
            />
            <textarea 
              className="input-field" 
              placeholder="Bio" 
              value={profile.bio} 
              onChange={e => setProfile({...profile, bio: e.target.value})} 
              rows={3}
            />
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn" style={{ flex: 1 }}>Save</button>
              <button type="button" className="btn" style={{ flex: 1, background: 'transparent', border: '1px solid var(--text-muted)' }} onClick={() => setIsEditing(false)}>Cancel</button>
            </div>
          </form>
        )}
      </div>

      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          My Space
        </h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
          Publish to your space. Private posts are only visible to you.
        </p>
        <form onSubmit={handlePost} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <RichTextEditor
            value={newPostContent}
            onChange={setNewPostContent}
          />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button type="submit" className="btn">Publish</button>
            <div className="visibility-toggle">
              <button
                type="button"
                className={`visibility-btn ${visibility === 'public' ? 'active' : ''}`}
                onClick={() => setVisibility('public')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                Public
              </button>
              <button
                type="button"
                className={`visibility-btn ${visibility === 'private' ? 'active' : ''}`}
                onClick={() => setVisibility('private')}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Private
              </button>
            </div>
          </div>
        </form>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text-muted)', margin: 0 }}>
          Posts by You
        </h3>
        <div className="tab-bar">
          {[
            { key: 'all', label: 'All' },
            { key: 'public', label: 'Public' },
            { key: 'private', label: 'Private' },
          ].map(tab => (
            <button
              key={tab.key}
              className={`tab-btn ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="post-grid">
        {filteredPosts.map(post => (
          <div key={post._id} className="glass-card">
            <div className="post-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <strong style={{ color: 'var(--primary)' }}>{post.userId}</strong> • {new Date(post.createdAt).toLocaleString()}
              </div>
              <span className={`visibility-badge ${post.visibility === 'private' ? 'badge-private' : 'badge-public'}`}>
                {post.visibility === 'private' ? '🔒 Private' : '🌐 Public'}
              </span>
            </div>
            <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>
        ))}
        {filteredPosts.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>
          {activeTab === 'private' ? 'No private posts yet.' : activeTab === 'public' ? 'No public posts yet.' : "You haven't posted anything yet."}
        </p>}
      </div>
    </>
  );
}

function Profile({ currentUsername }) {
  const { userId } = useParams();
  const [profile, setProfile] = useState({ name: '', bio: '', followers: [], following: [] });
  const [posts, setPosts] = useState([]);
  
  const isFollowing = profile.followers?.includes(currentUsername);

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/${userId}`);
      setProfile({ name: res.data.name || '', bio: res.data.bio || '', followers: res.data.followers || [], following: res.data.following || [] });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts?userId=${userId}&viewer=${currentUsername}`);
      setPosts(res.data);
    } catch (err) {
      console.error('Error fetching user posts:', err);
    }
  };

  const handleFollowToggle = async () => {
    try {
      const endpoint = isFollowing ? 'unfollow' : 'follow';
      await axios.post(`${API_URL}/users/${userId}/${endpoint}`, { followerId: currentUsername });
      fetchProfile(); // Refresh followers list
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  return (
    <>
      <div className="glass-card" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h2 className="logo" style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>{profile.name || userId}</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>{profile.bio || 'No bio provided.'}</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          <div><strong style={{ color: 'var(--text-main)' }}>{profile.followers.length}</strong> Followers</div>
          <div><strong style={{ color: 'var(--text-main)' }}>{profile.following.length}</strong> Following</div>
        </div>

        <button 
          className="btn" 
          onClick={handleFollowToggle}
          style={{ 
            background: isFollowing ? 'transparent' : 'var(--primary)',
            border: isFollowing ? '1px solid var(--primary)' : 'none',
            color: 'var(--text-main)'
          }}
        >
          {isFollowing ? 'Unfollow' : 'Follow'}
        </button>
      </div>

      <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
        Public Posts by {profile.name || userId}
      </h3>
      <div className="post-grid">
        {posts.map(post => (
          <div key={post._id} className="glass-card">
            <div className="post-header">
              <strong style={{ color: 'var(--primary)' }}>{post.userId}</strong> • {new Date(post.createdAt).toLocaleString()}
            </div>
            <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
          </div>
        ))}
        {posts.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>This user hasn't posted anything public yet.</p>}
      </div>
    </>
  );
}

import { Navigate } from 'react-router-dom';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [username, setUsername] = useState(localStorage.getItem('username') || '');

  const handleLogout = () => {
    setToken(null);
    setUsername('');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  if (!token) {
    return <Login setGlobalToken={setToken} setGlobalUsername={setUsername} />;
  }

  return (
    <BrowserRouter>
      <Layout username={username} handleLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Navigate to="/our-space" replace />} />
          <Route path="/our-space" element={<OurSpace currentUsername={username} />} />
          <Route path="/my-space" element={<MySpace currentUsername={username} />} />
          <Route path="/profile/:userId" element={<Profile currentUsername={username} />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

export default App;

