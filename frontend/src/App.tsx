import React, { useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import RichTextEditor from './RichTextEditor';
import ChatStrip, { openChat } from './Chat';
import { useAppDispatch, useAppSelector } from './store/hooks';
import {
  setToken,
  setUsername,
  setCurrentUserProfile,
  setUnreadMessages,
  setFollowRequestsCount,
  clearSession,
} from './store/appSlice';
import { useReduxState } from './store/useReduxState';
import './index.css';

const API_URL = 'http://127.0.0.1:4000/api';
const MAX_PROFILE_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;

const readFileAsDataUrl = (file: File, onProgress?: (progress: number) => void): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onprogress = (event) => {
    if (event.lengthComputable && onProgress) {
      onProgress(Math.round((event.loaded / event.total) * 70));
    }
  };
  reader.onload = () => {
    if (onProgress) {
      onProgress(70);
    }
    resolve((reader.result as string) || '');
  };
  reader.onerror = () => reject(new Error('Failed to read image file'));
  reader.readAsDataURL(file);
});

const fetchProfilesByUserId = async (userIds) => {
  const uniqueUserIds = [...new Set((userIds || []).filter(Boolean))];
  if (!uniqueUserIds.length) {
    return {};
  }

  const profiles = await Promise.all(
    uniqueUserIds.map(async (id) => {
      try {
        const response = await axios.get(`${API_URL}/users/${id}`);
        return [
          id,
          {
            displayName: response.data?.name || id,
            profileImage: response.data?.profileImage || '',
          },
        ];
      } catch (error) {
        console.error(`Error fetching profile for ${id}:`, error);
        return [
          id,
          {
            displayName: id,
            profileImage: '',
          },
        ];
      }
    })
  );

  return Object.fromEntries(profiles);
};

function Avatar({ userId, imageSrc, size = 28 }) {
  const fallbackLabel = (userId || '?').slice(0, 1).toUpperCase();

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={`${userId || 'user'} avatar`}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          borderRadius: '50%',
          objectFit: 'cover',
          border: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255,255,255,0.08)',
        color: 'var(--text-main)',
        fontSize: `${Math.max(12, Math.floor(size * 0.45))}px`,
        fontWeight: 700,
        border: '1px solid rgba(255,255,255,0.2)',
        flexShrink: 0,
      }}
    >
      {fallbackLabel}
    </div>
  );
}

function Login({ setGlobalToken, setGlobalUsername }) {
  const [username, setUsername] = useReduxState<string>('login.username', '');
  const [email, setEmail] = useReduxState<string>('login.email', '');
  const [password, setPassword] = useReduxState<string>('login.password', '');
  const [confirmPassword, setConfirmPassword] = useReduxState<string>('login.confirmPassword', '');
  const [isRegistering, setIsRegistering] = useReduxState<boolean>('login.isRegistering', false);

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

function Layout({ username, handleLogout, userProfile, unreadMessages, children }) {
  const displayName = userProfile?.name || username;
  const followRequestsCount = useAppSelector((state) => state.app.followRequestsCount);

  return (
    <div className="app-container">
      <header className="header navbar">
        <Link to="/our-space" className="logo" style={{ textDecoration: 'none' }}>Nexus</Link>
        <div className="navbar-right">
          <nav className="navbar-links">
            <Link to="/our-space" style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: '500' }}>Our Space</Link>
            <Link to="/my-space" style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: '500', position: 'relative' }}>
              My Space
              {followRequestsCount > 0 && (
                <span className="navbar-notification-badge" style={{ position: 'absolute', top: '-11px', right: '-13px', minWidth: '16px', height: '16px', fontSize: '0.62rem', border: '1px solid var(--bg-dark)' }}>
                  {followRequestsCount}
                </span>
              )}
            </Link>
          </nav>
          <div style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)' }}></div>
          <Link to="/my-space" className="navbar-user-link">
            <Avatar userId={username} imageSrc={userProfile?.profileImage} size={24} />
            <div className="navbar-user-meta">
              <span className="navbar-display-name">{displayName}</span>
              <span className="navbar-username">@{username}</span>
            </div>
          </Link>
          <div className="navbar-notification" title="Unread messages">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {unreadMessages > 0 && <span className="navbar-notification-badge">{unreadMessages > 99 ? '99+' : unreadMessages}</span>}
          </div>
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
  const [posts, setPosts] = useReduxState<any[]>(`ourSpace.${currentUsername}.posts`, []);
  const [profilesByUserId, setProfilesByUserId] = useReduxState<Record<string, any>>(`ourSpace.${currentUsername}.profilesByUserId`, {});
  const [newPostContent, setNewPostContent] = useReduxState<string>(`ourSpace.${currentUsername}.newPostContent`, '');
  const [visibility, setVisibility] = useReduxState<'public' | 'private'>(`ourSpace.${currentUsername}.visibility`, 'public');
  const [searchQuery, setSearchQuery] = useReduxState<string>(`ourSpace.${currentUsername}.searchQuery`, '');
  const [searchResults, setSearchResults] = useReduxState<any[]>(`ourSpace.${currentUsername}.searchResults`, []);
  const [isSearching, setIsSearching] = useReduxState<boolean>(`ourSpace.${currentUsername}.isSearching`, false);

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
        const profileMap = await fetchProfilesByUserId(postsRes.data.map((post) => post.userId));
        setProfilesByUserId(profileMap);
      } else {
        setPosts([]);
        setProfilesByUserId({});
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
      const res = await axios.get(`${API_URL}/users/search?q=${encodeURIComponent(q)}`);
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

  const handleToggleLike = async (postId) => {
    try {
      const res = await axios.post(`${API_URL}/posts/${postId}/like`, { userId: currentUsername });
      setPosts((prev) => prev.map((post) => (post._id === postId ? res.data.post : post)));
    } catch (err) {
      console.error('Like toggle error:', err);
      const message = err.response?.data?.error || 'Could not update like.';
      alert(message);
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
                    <Avatar userId={u.userId} imageSrc={u.profileImage} size={24} />
                    <div style={{ marginLeft: '0.6rem', flex: 1 }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{u.name || u.userId}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>@{u.userId}</div>
                    </div>
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
            <div className="post-header" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Avatar userId={post.userId} imageSrc={profilesByUserId[post.userId]?.profileImage} size={28} />
              <div>
                <Link to={`/profile/${post.userId}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 'bold' }}>
                  {profilesByUserId[post.userId]?.displayName || post.userId}
                </Link>
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>@{post.userId}</span>
                <span style={{ color: 'var(--text-muted)' }}> • {new Date(post.createdAt).toLocaleString()}</span>
              </div>
            </div>
            <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
            {post.userId !== currentUsername && (
              <div className="post-actions">
                <button
                  type="button"
                  className={`like-btn ${(post.likes || []).includes(currentUsername) ? 'liked' : ''}`}
                  onClick={() => handleToggleLike(post._id)}
                >
                  <span>❤</span>
                  <span>{(post.likes || []).includes(currentUsername) ? 'Liked' : 'Like'}</span>
                  <span className="like-count">{(post.likes || []).length}</span>
                </button>
              </div>
            )}
          </div>
        ))}
        {posts.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>You aren't following anyone yet, or they haven't posted. Use the search bar above to find people!</p>}
      </div>
    </>
  );
}


function MySpace({ currentUsername, onProfileUpdated }) {
  const [profile, setProfile] = useReduxState<any>(`mySpace.${currentUsername}.profile`, { name: '', bio: '', profileImage: '', followers: [], following: [], followRequests: [] });
  const [posts, setPosts] = useReduxState<any[]>(`mySpace.${currentUsername}.posts`, []);
  const [profilesByUserId, setProfilesByUserId] = useReduxState<Record<string, any>>(`mySpace.${currentUsername}.profilesByUserId`, {});
  const [newPostContent, setNewPostContent] = useReduxState<string>(`mySpace.${currentUsername}.newPostContent`, '');
  const [visibility, setVisibility] = useReduxState<'public' | 'private'>(`mySpace.${currentUsername}.visibility`, 'public');
  const [isEditing, setIsEditing] = useReduxState<boolean>(`mySpace.${currentUsername}.isEditing`, false);
  const [activeTab, setActiveTab] = useReduxState<'all' | 'public' | 'private'>(`mySpace.${currentUsername}.activeTab`, 'all');
  const [isImageDialogOpen, setIsImageDialogOpen] = useReduxState<boolean>(`mySpace.${currentUsername}.isImageDialogOpen`, false);
  const [selectedImageFile, setSelectedImageFile] = useReduxState<File | null>(`mySpace.${currentUsername}.selectedImageFile`, null);
  const [selectedImageName, setSelectedImageName] = useReduxState<string>(`mySpace.${currentUsername}.selectedImageName`, '');
  const [imageUploadProgress, setImageUploadProgress] = useReduxState<number>(`mySpace.${currentUsername}.imageUploadProgress`, 0);
  const [isImageUploading, setIsImageUploading] = useReduxState<boolean>(`mySpace.${currentUsername}.isImageUploading`, false);
  const [pendingProfileImage, setPendingProfileImage] = useReduxState<string>(`mySpace.${currentUsername}.pendingProfileImage`, '');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, [currentUsername]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/${currentUsername}`);
      const loadedProfile = {
        name: res.data.name || '',
        bio: res.data.bio || '',
        profileImage: res.data.profileImage || '',
        followers: res.data.followers || [],
        following: res.data.following || [],
        followRequests: res.data.followRequests || [],
      };
      setProfile(loadedProfile);

      if (loadedProfile.followRequests.length > 0) {
        const reqProfiles = await fetchProfilesByUserId(loadedProfile.followRequests);
        setProfilesByUserId((prev) => ({ ...prev, ...reqProfiles }));
      }

      if (onProfileUpdated) {
        onProfileUpdated(loadedProfile);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    try {
      await axios.post(`${API_URL}/users/${currentUsername}/accept-follow-request`, { followerId: requesterId });
      fetchProfile();
    } catch (err) {
      console.error('Error accepting follow request:', err);
    }
  };

  const handleDeclineRequest = async (requesterId: string) => {
    try {
      await axios.post(`${API_URL}/users/${currentUsername}/reject-follow-request`, { followerId: requesterId });
      fetchProfile();
    } catch (err) {
      console.error('Error declining follow request:', err);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts?userId=${currentUsername}&viewer=${currentUsername}`);
      setPosts(res.data);
      const profileMap = await fetchProfilesByUserId(res.data.map((post) => post.userId));
      setProfilesByUserId(profileMap);
    } catch (err) {
      console.error('Error fetching user posts:', err);
    }
  };

  const handleProfileImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE_BYTES) {
      alert('Profile image must be 2MB or smaller.');
      e.target.value = '';
      return;
    }

    setSelectedImageFile(file);
    setSelectedImageName(file.name);
    setImageUploadProgress(0);
    e.target.value = '';
  };

  const openImageDialog = () => {
    setSelectedImageFile(null);
    setSelectedImageName('');
    setImageUploadProgress(0);
    setIsImageDialogOpen(true);
  };

  const closeImageDialog = () => {
    if (isImageUploading) {
      return;
    }
    setIsImageDialogOpen(false);
  };

  const handleUploadProfileImage = async () => {
    if (!selectedImageFile || isImageUploading) {
      return;
    }

    setIsImageUploading(true);
    setImageUploadProgress(5);

    try {
      const imageDataUrl = await readFileAsDataUrl(selectedImageFile, (progress) => {
        setImageUploadProgress(Math.max(5, Math.min(progress, 95)));
      });

      setImageUploadProgress(100);
      setPendingProfileImage(imageDataUrl);

      setTimeout(() => {
        setIsImageDialogOpen(false);
        setIsImageUploading(false);
        setSelectedImageFile(null);
        setSelectedImageName('');
        setImageUploadProgress(0);
      }, 350);
    } catch (error) {
      console.error('Error processing profile image:', error);
      alert('Could not process your image. Please try again.');
      setIsImageUploading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const nextProfile = {
        ...profile,
        profileImage: pendingProfileImage || profile.profileImage || '',
      };

      await axios.post(`${API_URL}/users/${currentUsername}`, nextProfile);
      setProfile(nextProfile);
      setPendingProfileImage('');
      setProfilesByUserId((prev) => ({
        ...prev,
        [currentUsername]: {
          displayName: nextProfile.name || currentUsername,
          profileImage: nextProfile.profileImage || '',
        },
      }));
      if (onProfileUpdated) {
        onProfileUpdated(nextProfile);
      }
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
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
          <Avatar userId={currentUsername} imageSrc={profile.profileImage} size={82} />
        </div>
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
            <div className="profile-image-row">
              <div>
                <div className="profile-image-title">Profile Image</div>
                <small style={{ color: 'var(--text-muted)' }}>PNG, JPG, GIF, WEBP up to 2MB</small>
                {pendingProfileImage && (
                  <div style={{ color: '#a5b4fc', marginTop: '0.35rem', fontSize: '0.8rem' }}>
                    New image selected. Click Save to apply.
                  </div>
                )}
              </div>
              <button type="button" className="upload-btn" onClick={openImageDialog}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                Upload Image
              </button>
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="submit" className="btn" style={{ flex: 1 }}>Save</button>
              <button
                type="button"
                className="btn"
                style={{ flex: 1, background: 'transparent', border: '1px solid var(--text-muted)' }}
                onClick={() => {
                  setPendingProfileImage('');
                  setIsEditing(false);
                  fetchProfile();
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {isImageDialogOpen && (
        <div className="dialog-backdrop" onClick={closeImageDialog}>
          <div className="upload-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="upload-dialog-head">
              <h3 style={{ margin: 0 }}>Upload Profile Image</h3>
              <button
                type="button"
                className="dialog-close-btn"
                onClick={closeImageDialog}
                disabled={isImageUploading}
              >
                ×
              </button>
            </div>

            <div className="upload-dropzone">
              <Avatar userId={currentUsername} imageSrc={profile.profileImage} size={64} />
              <p style={{ margin: '0.75rem 0 0.25rem', color: 'var(--text-main)' }}>
                {selectedImageName || 'Choose an image to upload'}
              </p>
              <small style={{ color: 'var(--text-muted)' }}>Your avatar appears ahead of every post.</small>
              <input
                ref={fileInputRef}
                id="profile-image-upload"
                type="file"
                accept="image/*"
                onChange={handleProfileImageChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="upload-secondary-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImageUploading}
              >
                Choose File
              </button>
            </div>

            <div className="upload-progress-wrap">
              <div className="upload-progress-label">
                <span>{isImageUploading ? 'Processing image...' : 'Ready to process'}</span>
                <span>{imageUploadProgress}%</span>
              </div>
              <div className="upload-progress-track">
                <div className="upload-progress-fill" style={{ width: `${imageUploadProgress}%` }} />
              </div>
            </div>

            <div className="upload-dialog-actions">
              <button type="button" className="btn" style={{ background: 'transparent', border: '1px solid var(--text-muted)' }} onClick={closeImageDialog} disabled={isImageUploading}>Cancel</button>
              <button type="button" className="btn" onClick={handleUploadProfileImage} disabled={!selectedImageFile || isImageUploading}>
                {isImageUploading ? 'Processing...' : 'Use This Image'}
              </button>
            </div>
          </div>
        </div>
      )}

      {profile.followRequests && profile.followRequests.length > 0 && (
        <div className="glass-card" style={{ marginBottom: '2rem', border: '1px solid rgba(99, 102, 241, 0.25)', background: 'rgba(99, 102, 241, 0.03)' }}>
          <h3 style={{ margin: '0 0 1.25rem 0', color: '#a5b4fc', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
            Follow Requests ({profile.followRequests.length})
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            {profile.followRequests.map((reqId) => (
              <div key={reqId} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '14px', border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar userId={reqId} imageSrc={profilesByUserId[reqId]?.profileImage} size={38} />
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-main)', fontSize: '0.9rem' }}>{profilesByUserId[reqId]?.displayName || reqId}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>@{reqId}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => handleAcceptRequest(reqId)} className="btn" style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', borderRadius: '10px' }}>
                    Accept
                  </button>
                  <button onClick={() => handleDeclineRequest(reqId)} style={{ padding: '0.45rem 1rem', fontSize: '0.8rem', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text-muted)', borderRadius: '10px', cursor: 'pointer', fontWeight: 600 }}>
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
          {([
            { key: 'all', label: 'All' },
            { key: 'public', label: 'Public' },
            { key: 'private', label: 'Private' },
          ] as const).map(tab => (
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Avatar userId={post.userId} imageSrc={profilesByUserId[post.userId]?.profileImage} size={28} />
                <div>
                  <strong style={{ color: 'var(--primary)' }}>{profilesByUserId[post.userId]?.displayName || post.userId}</strong>
                  <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>@{post.userId}</span>
                  <span style={{ color: 'var(--text-muted)' }}> • {new Date(post.createdAt).toLocaleString()}</span>
                </div>
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
  const [profile, setProfile] = useReduxState<any>(`profilePage.${userId}.profile`, { name: '', bio: '', profileImage: '', followers: [], following: [], followRequests: [] });
  const [posts, setPosts] = useReduxState<any[]>(`profilePage.${userId}.posts`, []);
  const [profilesByUserId, setProfilesByUserId] = useReduxState<Record<string, any>>(`profilePage.${userId}.profilesByUserId`, {});
  
  const isFollowing = profile.followers?.includes(currentUsername);
  const isRequested = profile.followRequests?.includes(currentUsername);

  useEffect(() => {
    fetchProfile();
    fetchUserPosts();
  }, [userId]);

  const fetchProfile = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/${userId}`);
      setProfile({
        name: res.data.name || '',
        bio: res.data.bio || '',
        profileImage: res.data.profileImage || '',
        followers: res.data.followers || [],
        following: res.data.following || [],
        followRequests: res.data.followRequests || [],
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchUserPosts = async () => {
    try {
      const res = await axios.get(`${API_URL}/posts?userId=${userId}&viewer=${currentUsername}`);
      setPosts(res.data);
      const profileMap = await fetchProfilesByUserId(res.data.map((post) => post.userId));
      setProfilesByUserId(profileMap);
    } catch (err) {
      console.error('Error fetching user posts:', err);
    }
  };

  const handleFollowToggle = async () => {
    try {
      if (isFollowing) {
        await axios.post(`${API_URL}/users/${userId}/unfollow`, { followerId: currentUsername });
      } else if (isRequested) {
        await axios.post(`${API_URL}/users/${userId}/cancel-follow-request`, { followerId: currentUsername });
      } else {
        await axios.post(`${API_URL}/users/${userId}/follow-request`, { followerId: currentUsername });
      }
      fetchProfile(); // Refresh followers and requests list
    } catch (err) {
      console.error('Error toggling follow:', err);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      const res = await axios.post(`${API_URL}/posts/${postId}/like`, { userId: currentUsername });
      setPosts((prev) => prev.map((post) => (post._id === postId ? res.data.post : post)));
    } catch (err) {
      console.error('Like toggle error:', err);
      const message = err.response?.data?.error || 'Could not update like.';
      alert(message);
    }
  };

  const showPosts = userId === currentUsername || isFollowing;

  return (
    <>
      <div className="glass-card" style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
          <Avatar userId={userId} imageSrc={profile.profileImage} size={82} />
        </div>
        <h2 className="logo" style={{ marginBottom: '0.5rem', fontSize: '2.5rem' }}>{profile.name || userId}</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>{profile.bio || 'No bio provided.'}</p>
        
        <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
          <div><strong style={{ color: 'var(--text-main)' }}>{profile.followers.length}</strong> Followers</div>
          <div><strong style={{ color: 'var(--text-main)' }}>{profile.following.length}</strong> Following</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button 
            className="btn" 
            onClick={handleFollowToggle}
            style={{ 
              background: isFollowing ? 'transparent' : isRequested ? 'rgba(255,255,255,0.02)' : 'var(--primary)',
              border: isFollowing ? '1px solid rgba(255,255,255,0.2)' : isRequested ? '1px solid rgba(255, 255, 255, 0.15)' : 'none',
              color: isFollowing ? 'var(--text-muted)' : isRequested ? 'var(--text-muted)' : 'var(--text-main)'
            }}
          >
            {isFollowing ? 'Unfollow' : isRequested ? 'Requested' : 'Follow'}
          </button>
          {currentUsername !== userId && (
            <button
              className="message-btn"
              onClick={() => openChat(userId)}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              Message
            </button>
          )}
        </div>
      </div>

      {!showPosts ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 2rem', marginTop: '2rem', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: '3.2rem', marginBottom: '1rem', filter: 'drop-shadow(0 0 15px rgba(99,102,241,0.25))' }}>🔒</div>
          <h3 style={{ color: 'var(--text-main)', marginBottom: '0.6rem', fontSize: '1.45rem', fontWeight: 800 }}>This Account is Private</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '380px', margin: '0 auto', lineHeight: 1.5 }}>
            Follow this user to view their posts, photos, and active space updates.
          </p>
        </div>
      ) : (
        <>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
            Posts by {profile.name || userId}
          </h3>
          <div className="post-grid">
            {posts.map(post => (
              <div key={post._id} className="glass-card">
                <div className="post-header" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <Avatar userId={post.userId} imageSrc={profilesByUserId[post.userId]?.profileImage} size={28} />
                  <div>
                    <strong style={{ color: 'var(--primary)' }}>{profilesByUserId[post.userId]?.displayName || post.userId}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.4rem' }}>@{post.userId}</span>
                    <span style={{ color: 'var(--text-muted)' }}> • {new Date(post.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <div className="post-content" dangerouslySetInnerHTML={{ __html: post.content }} />
                {post.userId !== currentUsername && (
                  <div className="post-actions">
                    <button
                      type="button"
                      className={`like-btn ${(post.likes || []).includes(currentUsername) ? 'liked' : ''}`}
                      onClick={() => handleToggleLike(post._id)}
                    >
                      <span>❤</span>
                      <span>{(post.likes || []).includes(currentUsername) ? 'Liked' : 'Like'}</span>
                      <span className="like-count">{(post.likes || []).length}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
            {posts.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1 / -1', textAlign: 'center', padding: '2rem' }}>This user hasn't posted anything public yet.</p>}
          </div>
        </>
      )}
    </>
  );
}

import { Navigate } from 'react-router-dom';

function App() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.app.token);
  const username = useAppSelector((state) => state.app.username);
  const currentUserProfile = useAppSelector((state) => state.app.currentUserProfile);
  const unreadMessages = useAppSelector((state) => state.app.unreadMessages);

  useEffect(() => {
    const fetchCurrentUserProfile = async () => {
      if (!token || !username) {
        dispatch(setCurrentUserProfile({ name: '', profileImage: '' }));
        dispatch(setFollowRequestsCount(0));
        return;
      }

      try {
        const res = await axios.get(`${API_URL}/users/${username}`);
        dispatch(setCurrentUserProfile({
          name: res.data?.name || username,
          profileImage: res.data?.profileImage || '',
        }));
        dispatch(setFollowRequestsCount(res.data?.followRequests?.length || 0));
      } catch (error) {
        console.error('Error fetching current user profile for navbar:', error);
        dispatch(setCurrentUserProfile({ name: username, profileImage: '' }));
      }
    };

    fetchCurrentUserProfile();
    const interval = setInterval(fetchCurrentUserProfile, 8000);
    return () => clearInterval(interval);
  }, [token, username, dispatch]);

  const handleLogout = () => {
    dispatch(clearSession());
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const handleCurrentUserProfileUpdated = (profile) => {
    dispatch(setCurrentUserProfile({
      name: profile?.name || username,
      profileImage: profile?.profileImage || '',
    }));
  };

  if (!token) {
    return (
      <Login
        setGlobalToken={(newToken) => dispatch(setToken(newToken))}
        setGlobalUsername={(newUsername) => dispatch(setUsername(newUsername))}
      />
    );
  }

  return (
    <BrowserRouter>
      <Layout username={username} handleLogout={handleLogout} userProfile={currentUserProfile} unreadMessages={unreadMessages}>
        <Routes>
          <Route path="/" element={<Navigate to="/our-space" replace />} />
          <Route path="/our-space" element={<OurSpace currentUsername={username} />} />
          <Route path="/my-space" element={<MySpace currentUsername={username} onProfileUpdated={handleCurrentUserProfileUpdated} />} />
          <Route path="/profile/:userId" element={<Profile currentUsername={username} />} />
        </Routes>
      </Layout>
      <ChatStrip currentUsername={username} onUnreadChange={(count) => dispatch(setUnreadMessages(count))} />
    </BrowserRouter>
  );
}

export default App;

